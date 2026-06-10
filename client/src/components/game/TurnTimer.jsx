import styles from './TurnTimer.module.css'

export default function TurnTimer({ active, seconds, total = 30 }) {
  const urgency = seconds <= 5 ? 'critical' : seconds <= 10 ? 'high' : 'normal'
  const pct = Math.max(0, Math.min(100, (seconds / (total || 30)) * 100))

  return (
    <div className={`${styles.timer} ${active ? styles.active : styles.inactive}`}>
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
