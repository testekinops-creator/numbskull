import { useState, useEffect } from 'react'

// Returns true only after `active` has stayed true continuously for `delayMs`.
// Used to ignore brief blips — e.g. an opponent refreshing the page — so we don't
// flash an "opponent dropped" banner for a reconnect that resolves in a second.
export function useDelayedFlag(active, delayMs = 2500) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) { setShown(false); return }
    const t = setTimeout(() => setShown(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])
  return active && shown
}
