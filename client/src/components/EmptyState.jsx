import SkullMascot from './skull/SkullMascot.jsx'
import styles from './EmptyState.module.css'

// Shared empty-state: a judging skull, a roast line, and an optional CTA.
// Used for empty friends / leaderboard / search / badges lists so the app never
// shows a bare "nothing here".
export default function EmptyState({
  expression = 'judging',
  title,
  message,
  action = null,
  size = 92,
  className = '',
}) {
  return (
    <div className={`${styles.empty} ${className}`}>
      <SkullMascot expression={expression} size={size} />
      {title && <h3 className={styles.title}>{title}</h3>}
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
