import { useEffect, useRef } from 'react'

// If the player backgrounds the app / locks their phone for longer than the
// server's reconnect grace, the room is (or is about to be) closed server-side.
// So when they come back, send them to the game list instead of dropping them
// back into a dead room.
//
// We key this off the *real* away-time via the Page Visibility API rather than
// waiting for the server to detect the silent socket drop — on mobile that
// detection can lag ~45s behind the actual lock (Socket.IO ping timeout), which
// is why a room can still look "open" a minute after you locked the screen.
// `Date.now()` is captured before/after the JS-suspended gap, so the measured
// away-time stays accurate even while the tab was frozen.
const AWAY_LIMIT_MS = 60_000   // matches DISCONNECT_GRACE_MS on the server

export function useAwayTimeout(active, onExpire) {
  const hiddenAtRef = useRef(null)
  const cbRef = useRef(onExpire)
  useEffect(() => { cbRef.current = onExpire })

  useEffect(() => {
    if (!active) { hiddenAtRef.current = null; return }
    const onVis = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current) {
        const away = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        if (away > AWAY_LIMIT_MS) cbRef.current?.()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [active])
}
