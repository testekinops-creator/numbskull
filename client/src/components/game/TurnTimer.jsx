import { useEffect } from 'react'
import styles from './TurnTimer.module.css'
import { useHaptic } from '../../hooks/useHaptic.js'
import { useSound } from '../../hooks/useSound.js'

export default function TurnTimer({ active, seconds, total = 30 }) {
  const urgency = seconds <= 5 ? 'critical' : seconds <= 10 ? 'high' : 'normal'
  const pct = Math.max(0, Math.min(100, (seconds / (total || 30)) * 100))
  const { buzz } = useHaptic()
  const { playTick } = useSound()

  // Countdown ticker: a clock tick each second from 10s down, escalating to an
  // urgent tock (+ haptic pulse) in the final 5 — rising "time's running out" tension.
  useEffect(() => {
    if (!active || seconds > 10 || seconds < 1) return
    playTick(seconds <= 5)
    if (seconds <= 5) buzz('tick')
  }, [active, seconds, playTick, buzz])

  return (
    <div className={`${styles.timer} ${active ? styles.active : styles.inactive} ${active ? (styles[`${urgency}Wrap`] || '') : ''}`}>
      {/* Clipped track holds only the depleting fill. */}
      <div className={styles.track}>
        <div
          className={`${styles.bar} ${styles[urgency]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Label lives OUTSIDE the clipped track so it never gets cut off. */}
      {active && (
        <span className={`${styles.label} ${urgency === 'critical' ? styles.critLabel : urgency === 'high' ? styles.highLabel : ''}`}>
          {seconds}s
        </span>
      )}
    </div>
  )
}
