import { resolveAvatar } from '../../utils/avatars.js'
import styles from './Avatar.module.css'

// A round emoji avatar on a tinted gradient disc.
//   id     — chosen avatar id (optional)
//   seed   — stable identity for the deterministic fallback (playerId/username)
//   name   — tooltip + a11y label
//   size   — px diameter (default 40)
//   ring   — 'gold' | 'silver' | 'bronze' | 'cyan' | false — accent ring
//   online — true/false to show a presence dot; omit for no dot
const RING_CLASS = { gold: 'ringGold', silver: 'ringSilver', bronze: 'ringBronze', cyan: 'ringCyan', neon: 'ringNeon', rainbow: 'ringRainbow' }
export default function Avatar({ id, seed, name, size = 40, ring = false, online, className = '' }) {
  const { emoji, grad } = resolveAvatar(id, seed ?? name)
  const ringClass = styles[RING_CLASS[ring]] || ''
  return (
    <span
      className={`${styles.avatar} ${ringClass} ${className}`}
      style={{ '--av-size': `${size}px`, '--av-grad': grad }}
      title={name || undefined}
      role="img"
      aria-label={name ? `${name}'s avatar` : 'avatar'}
    >
      <span className={styles.emoji}>{emoji}</span>
      {online != null && (
        <span className={`${styles.dot} ${online ? styles.dotOn : styles.dotOff}`} aria-hidden="true" />
      )}
    </span>
  )
}
