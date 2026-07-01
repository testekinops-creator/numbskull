import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import { UsersIcon, RefreshIcon, CheckIcon } from '../icons/Icons.jsx'
import styles from './RoomToasts.module.css'

const TIL = ({ icon: I, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><I size={15} />{children}</span>
)

// Portaled overlay for the room's social notifications:
//  • opponent got ready          (#2)
//  • someone joined / reconnected (#1)
//  • incoming chat message bubble (#5)
// NOTE: friend requests + "now friends" live in the GLOBAL <FriendNotifications/>
// (App.jsx) so they show everywhere (lobby/home/mid-game) and aren't duplicated here.
const MAX_BUBBLES = 3      // never let the stack push the UI off-screen
const BUBBLE_MS   = 5000   // each message lingers this long, then fades

export default function RoomToasts({ chatOpen = false }) {
  const { state } = useRoom()
  const { playerId } = usePlayer()
  const opponent = state.room?.players?.find(p => p.id !== playerId)

  // ── Opponent ready (#2) ──────────────────────────────────────────────────
  const [readyToast, setReadyToast] = useState(null)
  const prevReady = useRef(false)
  useEffect(() => {
    const ready = !!opponent?.ready
    if (ready && !prevReady.current) {
      setReadyToast(`${opponent?.name || 'Opponent'} is ready!`)
      const t = setTimeout(() => setReadyToast(null), 2600)
      prevReady.current = ready
      return () => clearTimeout(t)
    }
    prevReady.current = ready
  }, [opponent?.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Someone joined the room (#1) ─────────────────────────────────────────
  // Diff the players list — covers every join path (code-join, quick-match,
  // party, bot). Baselines current players on mount/reconnect so only NEW
  // arrivals toast, and never toasts the viewer's own join. `name` is the
  // registered username OR the guest display name (both already in player.name).
  const [joinToast, setJoinToast] = useState(null)
  const seenPlayers = useRef(null)
  const joinTimer = useRef(null)
  useEffect(() => {
    const players = state.room?.players || []
    if (seenPlayers.current === null) { seenPlayers.current = new Set(players.map(p => p.id)); return }
    const fresh = players.filter(p => p.id !== playerId && !seenPlayers.current.has(p.id))
    players.forEach(p => seenPlayers.current.add(p.id))
    if (fresh.length) {
      const p = fresh[fresh.length - 1]
      setJoinToast(`${p.name || 'Someone'}${p.isBot ? ' (bot)' : ''} joined`)
      clearTimeout(joinTimer.current)
      joinTimer.current = setTimeout(() => setJoinToast(null), 2800)
    }
  }, [state.room?.players, playerId])
  useEffect(() => () => clearTimeout(joinTimer.current), [])

  // ── Someone reconnected (#1b) ────────────────────────────────────────────
  // Driven by the server's player:reconnected event (carries the name); fires
  // after a teammate/opponent recovers from a drop (phone lock / network blip).
  const [reconnectToast, setReconnectToast] = useState(null)
  const reconnectTs = useRef(0)
  const reconnectTimer = useRef(null)
  useEffect(() => {
    const rt = state.reconnectToast
    if (rt && rt.ts !== reconnectTs.current) {
      reconnectTs.current = rt.ts
      setReconnectToast(`${rt.name || 'A player'} reconnected`)
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(() => setReconnectToast(null), 2800)
    }
  }, [state.reconnectToast])
  useEffect(() => () => clearTimeout(reconnectTimer.current), [])

  // ── Incoming chat — stack downward (a mini inbox), newest at the bottom ───
  const [bubbles, setBubbles] = useState([])
  const seenRef   = useRef(null)   // ids already handled (null = not yet initialised)
  const timersRef = useRef([])
  useEffect(() => {
    const msgs = state.chatMessages || []
    // First run: mark existing history as seen so we don't replay it on mount /
    // reconnect — only messages that arrive AFTER this point pop up.
    if (seenRef.current === null) {
      seenRef.current = new Set(msgs.map(m => m.id))
      return
    }
    const fresh = msgs.filter(m => !m.mine && !seenRef.current.has(m.id))
    if (fresh.length === 0) return
    fresh.forEach(m => seenRef.current.add(m.id))
    // Chat panel already open → the message is visible there; skip the floating
    // bubble (it's marked seen above, so it won't pop later when the chat closes).
    if (chatOpen) return
    setBubbles(prev => [
      ...prev,
      ...fresh.map(m => ({ id: m.id, fromName: m.fromName, text: m.text })),
    ].slice(-MAX_BUBBLES))
    fresh.forEach(m => {
      const t = setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== m.id)), BUBBLE_MS)
      timersRef.current.push(t)
    })
  }, [state.chatMessages, chatOpen])
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])
  // Opening the chat clears any bubbles already floating (you're now reading them).
  useEffect(() => { if (chatOpen) setBubbles([]) }, [chatOpen])
  const dismissBubble = (id) => setBubbles(prev => prev.filter(b => b.id !== id))

  return (
    <>
      {/* Top-center: status notices (joins / reconnects / opponent ready) */}
      {createPortal(
        <div className={styles.layer}>
          {joinToast && <div className={`${styles.toast} ${styles.ready} anim-toast`}><TIL icon={UsersIcon}>{joinToast}</TIL></div>}
          {reconnectToast && <div className={`${styles.toast} ${styles.ready} anim-toast`}><TIL icon={RefreshIcon}>{reconnectToast}</TIL></div>}
          {readyToast && <div className={`${styles.toast} ${styles.ready} anim-toast`}><TIL icon={CheckIcon}>{readyToast}</TIL></div>}
        </div>,
        document.body,
      )}

      {/* Bottom-left: incoming chat bubbles float up right above the chat button,
          newest nearest the button, older ones rising above it. */}
      {createPortal(
        <div className={styles.chatLayer}>
          {bubbles.map(b => (
            <div key={b.id} className={styles.chatBubble} onClick={() => dismissBubble(b.id)}>
              <span className={styles.chatFrom}>{b.fromName}</span>
              <span className={styles.chatText}>{b.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
