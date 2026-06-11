import { useEffect, useRef } from 'react'

// Trap keyboard focus inside a container while it's `active` (modals, drawers,
// the game-over card). On activation it focuses the first focusable element;
// Tab / Shift+Tab cycle within the container; on deactivation focus returns to
// whatever was focused before. Purely additive — no visual change.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(active = true) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const prevFocused = document.activeElement

    const focusables = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement,
      )

    // Move focus into the trap (first focusable, else the container itself).
    const first = focusables()[0]
    if (first) first.focus()
    else { node.setAttribute('tabindex', '-1'); node.focus() }

    function onKeyDown(e) {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) { e.preventDefault(); return }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      // Restore focus to the trigger if it's still in the document.
      if (prevFocused && typeof prevFocused.focus === 'function' && document.contains(prevFocused)) {
        prevFocused.focus()
      }
    }
  }, [active])

  return ref
}
