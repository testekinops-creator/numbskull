import { useEffect } from 'react'

// One document-level listener that gives every primary CTA (.btn-primary /
// .btn-juice) a 10ms tap on press — no per-button wiring. Game-board feedback
// stays with useHaptic() in the components, which owns the richer patterns.
const ENABLED_KEY = 'ns_haptic_enabled'

export function useButtonHaptics() {
  useEffect(() => {
    if (!navigator.vibrate) return
    const onPress = (e) => {
      if (localStorage.getItem(ENABLED_KEY) === 'false') return
      const btn = e.target.closest?.('.btn-primary, .btn-juice')
      if (!btn || btn.disabled) return
      try { navigator.vibrate(10) } catch { /* noop */ }
    }
    document.addEventListener('pointerdown', onPress, { passive: true })
    return () => document.removeEventListener('pointerdown', onPress)
  }, [])
}
