import { useCallback } from 'react'

const PATTERNS = {
  correct: [50, 30, 80],
  wrong:   [20],
  error:   [10, 10, 10],
  win:     [80, 40, 120, 40, 200],
}

export function useHaptic() {
  const buzz = useCallback((type = 'wrong') => {
    if (!navigator.vibrate) return
    try {
      navigator.vibrate(PATTERNS[type] || PATTERNS.wrong)
    } catch {
      // ignore — vibration API not available
    }
  }, [])

  return { buzz }
}
