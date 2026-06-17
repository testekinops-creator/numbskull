import { useMemo } from 'react'
import { conflictCells } from '../../utils/tango.js'
import styles from './TangoBoard.module.css'

// Presentational Tango grid. Tap cycles a non-given cell empty → ☀️ → 🌙 → empty;
// givens are locked. Edge clues (`=` same / `×` opposite) sit on the boundary
// between the two cells they relate; rule violations glow red. Parent owns
// state + networking via onPlace(index, nextState).
const NEXT = { empty: 'sun', sun: 'moon', moon: 'empty' }
const GLYPH = { sun: '☀️', moon: '🌙' }

export default function TangoBoard({ n, givens = [], constraints = [], board, onPlace, disabled = false, solved = false }) {
  const conflicts = useMemo(
    () => (board ? conflictCells(board, n, constraints) : new Set()),
    [board, n, constraints],
  )
  // Map each clue to the LEFT/TOP cell it hangs off (a<b; b=a+1 → right edge, b=a+n → bottom edge).
  const { right, down } = useMemo(() => {
    const right = {}, down = {}
    for (const c of constraints) {
      if (c.b === c.a + 1) right[c.a] = c.type
      else if (c.b === c.a + n) down[c.a] = c.type
    }
    return { right, down }
  }, [constraints, n])

  if (!n || !board) return null
  const glyph = (t) => (t === 'eq' ? '=' : '×')

  return (
    <div
      className={`${styles.board} ${solved ? styles.solved : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      role="grid"
      aria-label="Tango board"
    >
      {board.map((cell, i) => {
        const given = !!givens[i]
        const conflict = conflicts.has(i)
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || given}
            className={`${styles.cell} ${given ? styles.given : ''} ${conflict ? styles.conflict : ''}`}
            onPointerUp={(e) => { e.preventDefault(); if (!disabled && !given) onPlace(i, NEXT[cell] || 'empty') }}
            aria-label={`Cell ${i + 1}: ${cell}${given ? ' (fixed)' : ''}`}
          >
            {cell !== 'empty' && <span className={styles.sym}>{GLYPH[cell]}</span>}
            {right[i] && <span className={`${styles.clue} ${styles.clueRight}`}>{glyph(right[i])}</span>}
            {down[i]  && <span className={`${styles.clue} ${styles.clueDown}`}>{glyph(down[i])}</span>}
          </button>
        )
      })}
    </div>
  )
}
