import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import styles from './RoomToasts.module.css'

// Portaled overlay for the room's social notifications:
//  • opponent got ready          (#2)
//  • incoming chat message bubble (#5)
//  • friend request + accepted    (#3)
export default function RoomToasts({ roomId }) {
  const { state, clearChatToast, acceptFriendRequest, clearIncomingFriend } = useRoom()
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

  // ── Incoming chat bubble (#5) ────────────────────────────────────────────
  const [chatToast, setChatToast] = useState(null)
  useEffect(() => {
    if (!state.lastIncomingChat) return
    setChatToast(state.lastIncomingChat)
    const t = setTimeout(() => { setChatToast(null); clearChatToast() }, 4200)
    return () => clearTimeout(t)
  }, [state.lastIncomingChat]) // eslint-disable-line react-hooks/exhaustive-deps

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

      {chatToast && (
        <div className={`${styles.chatBubble} anim-toast`} onClick={() => { setChatToast(null); clearChatToast() }}>
          <span className={styles.chatFrom}>{chatToast.fromName}</span>
          <span className={styles.chatText}>{chatToast.text}</span>
        </div>
      )}

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
