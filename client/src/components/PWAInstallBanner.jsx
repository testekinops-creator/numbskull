import { useState } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall.js'
import { SkullIcon, CloseIcon } from './icons/Icons.jsx'
import styles from './PWAInstallBanner.module.css'

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || dismissed) return null

  return (
    <div className={styles.banner}>
      <span className={styles.icon}><SkullIcon size={22} /></span>
      <div className={styles.text}>
        <strong>Install Numbskull</strong>
        <span>Play offline, get faster loads, and get roasted anywhere.</span>
      </div>
      <div className={styles.actions}>
        <button className="btn btn-juice btn-sm" onClick={install}>Install</button>
        <button className={styles.dismiss} onClick={() => setDismissed(true)} aria-label="Dismiss"><CloseIcon size={14} /></button>
      </div>
    </div>
  )
}
