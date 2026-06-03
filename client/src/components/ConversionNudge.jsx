import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import styles from './ConversionNudge.module.css'

const DISMISSED_KEY = 'ns_nudge_dismissed'
const SHOW_AFTER_GAMES = 3

export default function ConversionNudge() {
  const { isRegistered } = useAuth()
  const { totalGames } = usePlayer()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY))

  if (isRegistered || dismissed || totalGames < SHOW_AFTER_GAMES) return null

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className={styles.nudge} role="alert">
      <div className={styles.content}>
        <span className={styles.icon}>💀</span>
        <div className={styles.text}>
          <strong>{totalGames} games played.</strong>{' '}
          <span>Create a free account to save your streak and challenge friends.</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button className="btn btn-juice btn-sm" onClick={() => navigate('/register')}>Sign Up Free</button>
        <button className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  )
}
