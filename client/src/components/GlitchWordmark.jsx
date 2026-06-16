import styles from './GlitchWordmark.module.css'

// The "Numbskull" wordmark — clean, static, premium (the scramble/glitch
// animation was removed). White "Numb" + glowing cyan "skull"; styling lives in
// the CSS module. Name kept for its existing import sites.
export default function GlitchWordmark({ size = 'lg' }) {
  return (
    <h1 className={`${styles.wordmark} ${styles[size]}`} aria-label="Numbskull">
      <span className={styles.numb}>Numb</span>
      <span className={styles.skull}>skull</span>
    </h1>
  )
}
