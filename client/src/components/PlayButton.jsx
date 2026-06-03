import styles from './PlayButton.module.css'

export default function PlayButton({ onClick, pressed }) {
  return (
    <button
      className={`${styles.btn} ${pressed ? styles.active : ''}`}
      onClick={onClick}
      aria-label="Play Numbskull"
    >
      {/* Skull icon — scales and flies right on hover */}
      <span className={styles.icon} aria-hidden="true">💀</span>

      {/* "now!" slides in from left on hover */}
      <span className={styles.now}>now!</span>

      {/* "play" slides out to right on hover */}
      <span className={styles.play}>PLAY</span>
    </button>
  )
}
