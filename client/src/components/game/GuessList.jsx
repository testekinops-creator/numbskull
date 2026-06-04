import styles from './GuessList.module.css'

export default function GuessList({ guesses, mode }) {
  // Keep a STABLE key per guess (its position in the original array never
  // changes), then show newest-first. Index-of-reversed keys were re-shuffling
  // every render and leaving rows stuck mid-animation (blank bars).
  const rows = guesses
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => {
      const v = entry.value ?? entry.guess
      return v !== undefined && v !== null && String(v) !== ''
    })
    .reverse()

  if (rows.length === 0) return null

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Guess History</span>
        <span className={styles.count}>{rows.length}</span>
      </div>
      <ul className={styles.list} aria-label="Guess history">
        {rows.map(({ entry, idx }) => (
          <li key={idx} className={styles.item}>
            {mode === 'BC'
              ? <BCGuessRow entry={entry} />
              : <GTNGuessRow entry={entry} />
            }
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Bulls & Cows row ──────────────────────────────────────────
   - Bull  → CYAN tile  (correct digit, correct position)
   - Cow   → grey tile  (don't reveal which position)
   - Miss  → grey tile  (same as cow, hidden)
   - Message shows only the cow count
──────────────────────────────────────────────────────────────── */
function BCGuessRow({ entry }) {
  const value   = String(entry.value ?? entry.guess ?? '')
  const bulls   = entry.result?.bulls   ?? 0
  const cows    = entry.result?.cows    ?? 0
  const correct = entry.result?.correct
  const positions = entry.result?.positions || []

  return (
    <div className={styles.bcRow}>
      {/* digit tiles — only bulls get cyan, everything else is grey */}
      <div className={styles.tiles}>
        {value.split('').map((d, i) => {
          const isBull = positions[i] === 'bull'
          return (
            <span
              key={i}
              className={`${styles.tile} ${isBull ? styles.tileBull : styles.tileGrey}`}
            >
              {d}
            </span>
          )
        })}
      </div>

      {/* Result text — never reveal how many cows there are */}
      <div className={styles.bcMeta}>
        {correct && <span className={styles.correctText}>✓ Correct!</span>}
        {!correct && cows > 0 && (
          <span className={styles.cowMsg}>Guessed digits are in wrong position</span>
        )}
        {!correct && cows === 0 && bulls === 0 && (
          <span className={styles.noMatch}>No matches</span>
        )}
      </div>
    </div>
  )
}

/* ── GTN row ─────────────────────────────────────────────────── */
function GTNGuessRow({ entry }) {
  const value     = entry.value ?? entry.guess
  const direction = entry.result?.direction
  const correct   = entry.result?.correct
  const proximity = entry.result?.proximity

  return (
    <div className={styles.gtnRow}>
      <span className={`${styles.guessValue} ${styles[`prox${proximityClass(proximity)}`]}`}>
        {value}
      </span>
      {correct ? (
        <span className={styles.correctText}>✓ Correct!</span>
      ) : direction ? (
        <span className={styles.gtnHint}>
          {direction === 'higher' ? '↑ Go higher' : '↓ Go lower'}
        </span>
      ) : null}
    </div>
  )
}

function proximityClass(prox) {
  if (prox == null) return ''
  if (prox >= 0.9) return 'Hot'
  if (prox >= 0.6) return 'Warm'
  if (prox >= 0.3) return 'Cool'
  return 'Cold'
}
