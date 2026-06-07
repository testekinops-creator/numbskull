import styles from './PuzzleBoard.module.css'

// Renders the masked puzzle as word rows of letter tiles. `masked` is a string
// like "R__ ___" where '_' = hidden letter and ' ' = word gap.
export default function PuzzleBoard({ masked = '', category }) {
  const words = masked.split(' ')

  return (
    <div className={styles.board}>
      {category && <div className={styles.category}>{category}</div>}
      <div className={styles.words}>
        {words.map((word, wi) => (
          <div className={styles.word} key={wi}>
            {word.split('').map((ch, ci) => (
              <span
                key={ci}
                className={`${styles.tile} ${ch !== '_' ? styles.filled : ''}`}
              >
                {ch !== '_' ? ch : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
