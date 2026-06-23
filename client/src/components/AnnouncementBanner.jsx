import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { AlertIcon, ToolIcon, InfoIcon, CloseIcon } from './icons/Icons.jsx'
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
        {ann.type === 'warning' ? <AlertIcon size={18} /> : ann.type === 'maintenance' ? <ToolIcon size={18} /> : <InfoIcon size={18} />}
      </span>
      <p className={styles.msg}>{ann.message}</p>
      <button className={styles.close} onClick={() => setDismissed(true)} aria-label="Dismiss announcement"><CloseIcon size={15} /></button>
    </div>
  )
}
