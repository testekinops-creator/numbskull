import styles from './BCDigitTracker.module.css'

/**
 * Shows all 10 digits (0-9) colored by what we know from previous guesses:
 * 🟦 Cyan  = Bull (confirmed correct position in some guess)
 * 🟠 Orange = Cow  (in secret, wrong position)
 * ⬛ Dark   = Miss  (not in secret)
 * ⬜ Grey   = Unknown
 */
export default function BCDigitTracker({ guesses = [] }) {
  if (guesses.length === 0) return null

  // Build knowledge map from all guesses
  const knowledge = {}  // digit → 'bull' | 'cow' | 'miss'

  for (const entry of guesses) {
    const g   = String(entry.value ?? entry.guess ?? '')
    const pos = entry.result?.positions || []

    for (let i = 0; i < 4; i++) {
      const digit = g[i]
      if (!digit) continue
      const state = pos[i] || 'miss'

      // Upgrade: bull > cow > miss (never downgrade)
      if (state === 'bull') {
        knowledge[digit] = 'bull'
      } else if (state === 'cow' && knowledge[digit] !== 'bull') {
        knowledge[digit] = 'cow'
      } else if (state === 'miss' && !knowledge[digit]) {
        knowledge[digit] = 'miss'
      }
    }
  }

  const hasSomeInfo = Object.keys(knowledge).length > 0
  if (!hasSomeInfo) return null

  return (
    <div className={styles.tracker}>
      <p className={styles.label}>Digit hints</p>
      <div className={styles.digits}>
        {Array.from({ length: 10 }, (_, i) => String(i)).map(d => {
          const state = knowledge[d] || 'unknown'
          return (
            <span
              key={d}
              className={`${styles.digit} ${styles[state]}`}
              title={
                state === 'bull'    ? `${d}: correct position ✓` :
                state === 'cow'     ? `${d}: in secret, wrong position` :
                state === 'miss'    ? `${d}: not in secret` :
                `${d}: unknown`
              }
            >
              {d}
            </span>
          )
        })}
      </div>
    </div>
  )
}
