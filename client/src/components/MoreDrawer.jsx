import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isGuestMode } from '../pages/AuthGatePage.jsx'
import styles from './MoreDrawer.module.css'

export default function MoreDrawer({ open, onClose }) {
  const navigate  = useNavigate()
  const { isRegistered, user } = useAuth()

  const isAuthenticated = isRegistered || isGuestMode()

  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

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
        className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="More options"
      >
        <div className={styles.handle} />

        <div className={styles.inner}>

          {/* ── Only show Account section AFTER authentication ── */}
          {isAuthenticated ? (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Account</p>
              <div className={styles.grid}>

                {/* Profile — registered users only */}
                {isRegistered && (
                  <button className={styles.item} onClick={() => go('/profile')}>
                    <span className={styles.itemIcon}>👤</span>
                    <span className={styles.itemLabel}>{user?.username || 'Profile'}</span>
                  </button>
                )}

                {/* Settings — always */}
                <button className={styles.item} onClick={() => go('/settings')}>
                  <span className={styles.itemIcon}>⚙️</span>
                  <span className={styles.itemLabel}>Settings</span>
                </button>

                {/* Guest: show Sign Up + Log In, NOT a "Create Account" banner */}
                {!isRegistered && (
                  <>
                    <button className={styles.item} onClick={() => go('/register')}>
                      <span className={styles.itemIcon}>✨</span>
                      <span className={styles.itemLabel}>Sign Up</span>
                    </button>
                    <button className={styles.item} onClick={() => go('/login')}>
                      <span className={styles.itemIcon}>🔑</span>
                      <span className={styles.itemLabel}>Log In</span>
                    </button>
                  </>
                )}

              </div>
            </div>
          ) : (
            /* Before any auth — show only Settings */
            <div className={styles.section}>
              <div className={styles.grid}>
                <button className={styles.item} onClick={() => go('/settings')}>
                  <span className={styles.itemIcon}>⚙️</span>
                  <span className={styles.itemLabel}>Settings</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
