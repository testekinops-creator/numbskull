import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { celebrateBadge } from '../utils/celebrate.js'
import styles from './BadgeToast.module.css'   // reuse the toast styling for consistency

// Global "Level up!" celebration. Mounted once in App; listens for the
// 'ns-level-up' window event (fired by AuthContext.updateUser when the cached
// profile's level increases after a game / quest claim).
export default function LevelUpToast() {
  const [level, setLevel] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      const lvl = e.detail?.level
      if (!lvl) return
      setLevel(lvl)
      celebrateBadge()
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setLevel(null), 3600)
    }
    window.addEventListener('ns-level-up', handler)
    return () => { window.removeEventListener('ns-level-up', handler); clearTimeout(timer.current) }
  }, [])

  if (!level) return null

  return createPortal(
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.icon}>⭐</span>
      <div className={styles.text}>
        <span className={styles.label}>Level up!</span>
        <span className={styles.name}>You reached Level {level}</span>
      </div>
    </div>,
    document.body,
  )
}
