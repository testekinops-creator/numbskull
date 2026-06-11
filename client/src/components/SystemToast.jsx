import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSocket } from '../contexts/SocketContext.jsx'
import styles from './SystemToast.module.css'

// Global, lightweight notice for server-side feedback that isn't tied to a room
// (so it works in the lobby too, where RoomToasts isn't mounted). Right now it
// surfaces `error:rate_limited` — previously the server emitted it but nothing
// listened, so spammed / over-tapped actions silently did nothing. Kept generic
// so other transient server notices can reuse it.
export default function SystemToast() {
  const { socket } = useSocket()
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    if (!socket) return
    const show = (text) => {
      setMsg(text)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setMsg(null), 2500)
    }
    const onRateLimited = () => show('Whoa — slow down a sec ⏳')
    socket.on('error:rate_limited', onRateLimited)
    return () => {
      socket.off('error:rate_limited', onRateLimited)
      clearTimeout(timer.current)
    }
  }, [socket])

  if (!msg) return null
  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite">{msg}</div>,
    document.body,
  )
}
