import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isGuestMode } from '../pages/AuthGatePage.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import styles from './MoreDrawer.module.css'

// Premium left-edge slide navigation drawer (glassmorphism). Closes on: Escape,
// tap-outside (backdrop), the ✕ button, or a left swipe on the drawer itself.
export default function MoreDrawer({ open, onClose }) {
  const navigate  = useNavigate()
  const { isRegistered, user } = useAuth()
  const isAuthenticated = isRegistered || isGuestMode()

  const drawerRef = useRef(null)
  const startX = useRef(null)
  // Trap focus inside the drawer while open; merge with drawerRef (used for swipe).
  const trapRef = useFocusTrap(open)
  const setDrawerRef = useCallback((node) => { drawerRef.current = node; trapRef.current = node }, [trapRef])

  // Close on Escape + lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  // Swipe-to-close: drag the drawer left; release past a threshold to dismiss.
  function onTouchStart(e) {
    startX.current = e.touches[0].clientX
    if (drawerRef.current) drawerRef.current.style.transition = 'none'
  }
  function onTouchMove(e) {
    if (startX.current == null || !drawerRef.current) return
    const dx = Math.min(0, e.touches[0].clientX - startX.current)  // leftward only
    drawerRef.current.style.transform = `translateX(${dx}px)`
  }
  function onTouchEnd(e) {
    const el = drawerRef.current
    if (startX.current == null || !el) { startX.current = null; return }
    const dx = e.changedTouches[0].clientX - startX.current
    el.style.transition = ''
    el.style.transform = ''
    startX.current = null
    if (dx < -60) onClose()
  }

  function go(path) {
    onClose()
    setTimeout(() => navigate(path), 120)
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={setDrawerRef}
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={styles.header}>
          <span className={styles.title}>Menu</span>
          <button className={styles.close} onClick={onClose} aria-label="Close menu">✕</button>
        </div>

        <nav className={styles.nav}>
          {isAuthenticated && isRegistered && (
            <button className={styles.row} onClick={() => go('/profile')}>
              <span className={styles.rowIcon}>👤</span>
              <span className={styles.rowLabel}>{user?.username || 'Profile'}</span>
            </button>
          )}

          <button className={styles.row} onClick={() => go('/settings')}>
            <span className={styles.rowIcon}>⚙️</span>
            <span className={styles.rowLabel}>Settings</span>
          </button>

          {isAuthenticated && !isRegistered && (
            <>
              <button className={styles.row} onClick={() => go('/register')}>
                <span className={styles.rowIcon}>✨</span>
                <span className={styles.rowLabel}>Sign Up</span>
              </button>
              <button className={styles.row} onClick={() => go('/login')}>
                <span className={styles.rowIcon}>🔑</span>
                <span className={styles.rowLabel}>Log In</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  )
}
