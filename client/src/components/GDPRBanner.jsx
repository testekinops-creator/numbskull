import { useState, useEffect } from 'react'
import { CONSENT_KEY, initAnalytics } from '../services/analytics.js'
import styles from './GDPRBanner.module.css'

const DECISION_KEY = 'ns_gdpr_decided'

export default function GDPRBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(DECISION_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'yes')
    localStorage.setItem(DECISION_KEY, '1')
    initAnalytics()
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'no')
    localStorage.setItem(DECISION_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <div className={styles.text}>
        <strong>Cookies & Analytics</strong>{' '}
        We use privacy-friendly analytics (Plausible — no personal data, no tracking) to understand how the game is played.
        No cookies without consent.
      </div>
      <div className={styles.actions}>
        <button className="btn btn-juice btn-sm" onClick={accept}>Accept</button>
        <button className="btn btn-ghost btn-sm" onClick={decline}>Decline</button>
      </div>
    </div>
  )
}
