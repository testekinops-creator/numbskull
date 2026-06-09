import { useEffect } from 'react'

// Leaving the room view in-app (Back / swipe / nav) should tell the server so the
// opponent isn't left playing a ghost. But we must NOT leave:
//   • on a page reload/close — the socket drops and the reconnect grace covers it; or
//   • on React StrictMode's dev mount→unmount→remount cycle, which would
//     spuriously "leave" a room the instant you entered it (deleting it server-side
//     and breaking match start).
// So we DEFER the leave briefly and cancel it if a room view re-mounts within the
// window. A module-level timer is shared across the unmount/remount so the cancel
// lands. On a real exit nothing re-mounts, so the leave fires after the short delay.
let _timer = null
let _unloading = false

if (typeof window !== 'undefined') {
  const hide = () => { _unloading = true }
  const show = () => { _unloading = false }
  window.addEventListener('pagehide', hide)
  window.addEventListener('beforeunload', hide)
  window.addEventListener('pageshow', show)
}

export function useLeaveOnExit(roomId, leaveRoom, isConnected) {
  useEffect(() => {
    if (_timer) { clearTimeout(_timer); _timer = null }   // (re)mounted → cancel a pending leave
    return () => {
      if (_timer) clearTimeout(_timer)
      _timer = setTimeout(() => {
        _timer = null
        if (!_unloading && roomId && isConnected()) leaveRoom(roomId)
      }, 250)
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps
}
