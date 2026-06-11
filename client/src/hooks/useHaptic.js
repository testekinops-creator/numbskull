import { useCallback } from 'react'

const PATTERNS = {
  tap:     [10],
  tick:    [15],
  correct: [50, 30, 80],
  wrong:   [20],
  error:   [10, 10, 10],
  win:     [80, 40, 120, 40, 200],
}

// The Settings page exposes a "Haptic Feedback" toggle under this key; read it
// per-buzz (not per-mount) so flipping the toggle applies immediately everywhere.
const ENABLED_KEY = 'ns_haptic_enabled'
const enabled = () => localStorage.getItem(ENABLED_KEY) !== 'false'

export function useHaptic() {
  const buzz = useCallback((type = 'wrong') => {
    if (!navigator.vibrate || !enabled()) return
    try {
      navigator.vibrate(Array.isArray(type) ? type : (PATTERNS[type] || PATTERNS.wrong))
    } catch {
      // ignore — vibration API not available
    }
  }, [])

  return { buzz }
}
