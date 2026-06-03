import styles from './TurnTimer.module.css'

export default function TurnTimer({ active, seconds }) {
  const urgency = seconds <= 5 ? 'critical' : seconds <= 10 ? 'high' : 'normal'

  return (
    <div className={`${styles.timer} ${active ? styles.active : styles.inactive}`}>
      <div
        className={`${styles.bar} ${styles[urgency]}`}
        style={{ width: `${(seconds / 30) * 100}%` }}
      />
      {active && (
        <span className={`${styles.label} ${urgency === 'critical' ? styles.critLabel : ''}`}>
          {seconds}s
        </span>
      )}
    </div>
  )
}
