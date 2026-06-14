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
              <span className={`${styles.disc} ${styles.discProfile}`}><ProfileIcon /></span>
              <span className={styles.rowLabel}>{user?.username || 'Profile'}</span>
              <span className={styles.chev} aria-hidden="true">›</span>
            </button>
          )}

          <button className={styles.row} onClick={() => go('/settings')}>
            <span className={`${styles.disc} ${styles.discSettings}`}><SettingsIcon /></span>
            <span className={styles.rowLabel}>Settings</span>
            <span className={styles.chev} aria-hidden="true">›</span>
          </button>

          {isAuthenticated && !isRegistered && (
            <>
              <button className={styles.row} onClick={() => go('/register')}>
                <span className={`${styles.disc} ${styles.discSignup}`}><SignUpIcon /></span>
                <span className={styles.rowLabel}>Sign Up</span>
                <span className={styles.chev} aria-hidden="true">›</span>
              </button>
              <button className={styles.row} onClick={() => go('/login')}>
                <span className={`${styles.disc} ${styles.discLogin}`}><LoginIcon /></span>
                <span className={styles.rowLabel}>Log In</span>
                <span className={styles.chev} aria-hidden="true">›</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </>
  )
}

/* ── Crafted premium icons (stroke-based) ──────────────────────────────────── */
function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2.6v2.3M12 19.1v2.3M21.4 12h-2.3M5 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function SignUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M3 20c0-3.5 3.1-6 7-6 1.1 0 2.2.2 3.1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 14v6M21.5 17h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function LoginIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.2" stroke="currentColor" strokeWidth="2" />
      <path d="M10.9 10.9 20 20M16.5 19l2-2M14.5 21l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
