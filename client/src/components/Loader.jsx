import styles from './Loader.module.css'

// Premium branded loader: a cyan→pink gradient ring with a soft glow. Use the
// full form (optional label) for page/route/room loading, and `inline` (small,
// no label) inside buttons ("Starting…").
export default function Loader({ size = 48, label, inline = false, className = '' }) {
  if (inline) {
    return <span className={`${styles.ring} ${styles.inlineRing} ${className}`} style={{ '--loader-size': `${size}px` }} aria-hidden="true" />
  }
  return (
    <div className={`${styles.wrap} ${className}`} role="status" aria-live="polite">
      <span className={styles.ring} style={{ '--loader-size': `${size}px` }} aria-hidden="true" />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  )
}
