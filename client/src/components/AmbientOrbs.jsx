import styles from './AmbientOrbs.module.css'

// Soft, slow-drifting background orbs for a premium ambient feel. Decorative
// only (aria-hidden), pointer-events: none, sits behind content (z-index: -1 in
// an isolated parent), and animates transform ONLY so it's GPU-cheap. Fully
// disabled under prefers-reduced-motion.
export default function AmbientOrbs() {
  return (
    <div className={styles.orbs} aria-hidden="true">
      <span className={`${styles.orb} ${styles.orb1}`} />
      <span className={`${styles.orb} ${styles.orb2}`} />
      <span className={`${styles.orb} ${styles.orb3}`} />
    </div>
  )
}
