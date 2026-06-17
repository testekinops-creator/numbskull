import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import styles from './FriendNotifications.module.css'

// Global social notifications — mounted app-level (in App.jsx) so they appear
// EVERYWHERE: the lobby, home, mid-game. Two things:
//   1) an incoming friend request → premium Accept / Reject card (responds via
//      REST, so it works whether the request came from a room or a search).
//   2) brief toasts: "🟢 {name} is online" and "🤝 you're now friends with {name}".
// Guests (not registered) never receive these events, but we gate defensively.
const TOAST_MS = 3200

export default function FriendNotifications() {
  const { state, clearIncomingFriend } = useRoom()
  const { isRegistered } = useAuth()

  // ── Incoming request card ────────────────────────────────────────────────
  const incoming = state.incomingFriend
  const [busy, setBusy] = useState(false)
  // Resets the busy flag whenever a new/different request arrives.
  useEffect(() => { setBusy(false) }, [incoming?.fromUserId])

  const [flash, setFlash] = useState(null)   // local success line after accept
  const flashTimer = useRef(null)
  useEffect(() => () => clearTimeout(flashTimer.current), [])
  const showFlash = (text) => {
    setFlash(text)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), TOAST_MS)
  }

  const respond = async (action) => {
    if (busy) return
    const id = incoming?.fromUserId
    const name = incoming?.fromName
    clearIncomingFriend()          // optimistic — the card always dismisses on a click
    if (!id) return                // no userId (legacy payload) → can't REST; just dismiss
    setBusy(true)
    try {
      await api.post(`/users/${id}/friend/${action}`)
      if (action === 'accept') showFlash(`🤝 You're now friends with ${name || 'them'}!`)
    } catch {
      // Already-friends / expired request etc. — silent; the card is gone either way.
    } finally {
      setBusy(false)
    }
  }

  // ── "Friend came online" toast ───────────────────────────────────────────
  const [presenceMsg, setPresenceMsg] = useState(null)
  const presenceTs = useRef(0)
  const presenceTimer = useRef(null)
  useEffect(() => {
    const p = state.friendPresence
    if (p?.online && p.ts !== presenceTs.current) {
      presenceTs.current = p.ts
      setPresenceMsg(`🟢 ${p.name || 'A friend'} is online`)
      clearTimeout(presenceTimer.current)
      presenceTimer.current = setTimeout(() => setPresenceMsg(null), TOAST_MS)
    }
  }, [state.friendPresence])
  useEffect(() => () => clearTimeout(presenceTimer.current), [])

  // ── "X accepted your request" toast (for the original sender) ─────────────
  const [acceptedMsg, setAcceptedMsg] = useState(null)
  const acceptedTs = useRef(0)
  const acceptedTimer = useRef(null)
  useEffect(() => {
    const a = state.friendAccepted
    if (a?.name && a.ts !== acceptedTs.current) {
      acceptedTs.current = a.ts
      setAcceptedMsg(`🤝 ${a.name} accepted your friend request`)
      clearTimeout(acceptedTimer.current)
      acceptedTimer.current = setTimeout(() => setAcceptedMsg(null), TOAST_MS)
    }
  }, [state.friendAccepted])
  useEffect(() => () => clearTimeout(acceptedTimer.current), [])

  if (!isRegistered) return null
  if (!incoming && !presenceMsg && !acceptedMsg && !flash) return null

  return createPortal(
    <div className={styles.layer}>
      {presenceMsg && <div className={`${styles.toast} ${styles.online}`} role="status">{presenceMsg}</div>}
      {acceptedMsg && <div className={`${styles.toast} ${styles.accepted}`} role="status">{acceptedMsg}</div>}
      {flash && <div className={`${styles.toast} ${styles.accepted}`} role="status">{flash}</div>}

      {incoming && (
        <div className={styles.card} role="dialog" aria-label="Friend request">
          <div className={styles.cardBody}>
            <span className={styles.icon}>👋</span>
            <span className={styles.text}>
              <strong>{incoming.fromName || 'Someone'}</strong> wants to be friends
            </span>
          </div>
          <div className={styles.actions}>
            <button className={styles.accept} disabled={busy} onClick={() => respond('accept')}>Accept</button>
            <button className={styles.reject} disabled={busy} onClick={() => respond('decline')}>Reject</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
