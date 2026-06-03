import styles from './GuessList.module.css'

export default function GuessList({ guesses, mode }) {
  if (guesses.length === 0) return null

  return (
    <ul className={styles.list} aria-label="Guess history">
      {[...guesses].reverse().map((entry, i) => (
        <li key={i} className={`${styles.item} anim-slide-up`}>
          {mode === 'BC'
            ? <BCGuessRow entry={entry} />
            : <GTNGuessRow entry={entry} />
          }
        </li>
      ))}
    </ul>
  )
}

/* ── Bulls & Cows row — colored digit tiles ──────────────────── */
function BCGuessRow({ entry }) {
  const digits    = String(entry.value || entry.guess || '').split('')
  const positions = entry.result?.positions || []
  const bulls     = entry.result?.bulls ?? 0
  const cows      = entry.result?.cows  ?? 0
  const correct   = entry.result?.correct

  return (
    <div className={styles.bcRow}>
      {/* Digit tiles */}
      <div className={styles.tiles}>
        {digits.map((d, i) => {
          const state = positions[i] || 'miss'
          return (
            <span
              key={i}
              className={`${styles.tile} ${styles[`tile_${state}`]}`}
              aria-label={`${d} — ${state}`}
            >
              {d}
            </span>
          )
        })}
      </div>

      {/* Summary */}
      <div className={styles.bcSummary}>
        {correct ? (
          <span className={styles.correctTag}>✓ Correct!</span>
        ) : (
          <>
            <span className={styles.bullCount}>
              🐂 <strong>{bulls}</strong>
            </span>
            <span className={styles.cowCount}>
              🐄 <strong>{cows}</strong>
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Guess The Number row ─────────────────────────────────────── */
function GTNGuessRow({ entry }) {
  const value     = entry.value ?? entry.guess
  const direction = entry.result?.direction
  const correct   = entry.result?.correct
  const proximity = entry.result?.proximity

  return (
    <div className={styles.gtnRow}>
      <span className={`${styles.gtnValue} ${styles[`prox${proximityClass(proximity)}`]}`}>
        {value}
      </span>
      {correct ? (
        <span className={styles.correctTag}>✓ Correct!</span>
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
