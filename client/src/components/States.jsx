import SkullMascot from './skull/SkullMascot.jsx'
import { InfoIcon } from './icons/Icons.jsx'
import styles from './States.module.css'

// Reusable error state — skull + message + optional retry.
export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className={`${styles.block} anim-slide-up`} role="alert">
      <SkullMascot expression="annoyed" size={72} />
      <p className={styles.msg}>{message}</p>
      {onRetry && <button className="btn btn-juice btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  )
}

// Reusable empty state — icon + message + optional call-to-action.
export function EmptyState({ icon = <InfoIcon size={28} />, message, actionLabel, onAction }) {
  return (
    <div className={`${styles.block} anim-slide-up`}>
      <span className={styles.icon}>{icon}</span>
      <p className={styles.msg}>{message}</p>
      {actionLabel && onAction && (
        <button className="btn btn-juice btn-sm" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  )
}
