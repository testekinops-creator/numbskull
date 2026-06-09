import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import styles from './RoomToasts.module.css'

// Portaled overlay for the room's social notifications:
//  • opponent got ready          (#2)
//  • incoming chat message bubble (#5)
//  • friend request + accepted    (#3)
const MAX_BUBBLES = 4      // never let the stack push the UI off-screen
const BUBBLE_MS   = 5000   // each message lingers this long, then fades

export default function RoomToasts({ roomId }) {
  const { state, acceptFriendRequest, clearIncomingFriend } = useRoom()
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
    setBubbles(prev => [
      ...prev,
      ...fresh.map(m => ({ id: m.id, fromName: m.fromName, text: m.text })),
    ].slice(-MAX_BUBBLES))
    fresh.forEach(m => {
      const t = setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== m.id)), BUBBLE_MS)
      timersRef.current.push(t)
    })
  }, [state.chatMessages])
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])
  const dismissBubble = (id) => setBubbles(prev => prev.filter(b => b.id !== id))

  // ── Friend accepted (#3) ─────────────────────────────────────────────────
  const [friendMsg, setFriendMsg] = useState(null)
  useEffect(() => {
    if (state.friendStatus === 'friends') {
      setFriendMsg("You're now friends! 🎉")
      const t = setTimeout(() => setFriendMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [state.friendStatus])

  return createPortal(
    <div className={styles.layer}>
      {readyToast && <div className={`${styles.toast} ${styles.ready} anim-toast`}>✅ {readyToast}</div>}
      {friendMsg && <div className={`${styles.toast} ${styles.friend} anim-toast`}>🤝 {friendMsg}</div>}

      {bubbles.map(b => (
        <div key={b.id} className={`${styles.chatBubble} anim-toast`} onClick={() => dismissBubble(b.id)}>
          <span className={styles.chatFrom}>{b.fromName}</span>
          <span className={styles.chatText}>{b.text}</span>
        </div>
      ))}

      {state.incomingFriend && (
        <div className={`${styles.friendCard} anim-toast`} role="dialog" aria-label="Friend request">
          <span className={styles.friendCardText}>
            <strong>{state.incomingFriend.fromName}</strong> wants to be friends
          </span>
          <div className={styles.friendCardActions}>
            <button className={styles.accept} onClick={() => acceptFriendRequest(roomId)}>Accept</button>
            <button className={styles.dismiss} onClick={clearIncomingFriend}>Later</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
