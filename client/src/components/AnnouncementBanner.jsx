import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import styles from './AnnouncementBanner.module.css'

export default function AnnouncementBanner() {
  const [ann, setAnn] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    api.get('/announcements')
      .then(d => { if (d.announcements?.length) setAnn(d.announcements[0]) })
      .catch(() => {})
  }, [])

  if (!ann || dismissed) return null

  const typeClass = ann.type === 'warning' ? styles.warning
    : ann.type === 'maintenance' ? styles.maintenance
    : styles.info

  return (
    <div className={`${styles.banner} ${typeClass}`} role="alert">
      <span className={styles.icon}>
        {ann.type === 'warning' ? '⚠️' : ann.type === 'maintenance' ? '🔧' : 'ℹ️'}
      </span>
      <p className={styles.msg}>{ann.message}</p>
      <button className={styles.close} onClick={() => setDismissed(true)} aria-label="Dismiss announcement">✕</button>
    </div>
  )
}
