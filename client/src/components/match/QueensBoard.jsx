import { useMemo } from 'react'
import { REGION_COLORS, conflictCells } from '../../utils/queens.js'
import styles from './QueensBoard.module.css'

// Presentational Queens grid. Owns only the tap-cycle (empty → 👑 → ✕ → empty);
// the parent handles state + networking via onPlace(index, nextState). Region
// fills + thick region-boundary borders + live conflict rings come from here, so
// both multiplayer (MatchRoom) and solo (QueensSoloPage) render identically.
const NEXT = { empty: 'queen', queen: 'x', x: 'empty' }

export default function QueensBoard({ n, regions, board, onPlace, disabled = false, solved = false, highlights = [], onHighlight }) {
  const conflicts = useMemo(
    () => (board ? conflictCells(board, regions, n) : new Set()),
    [board, regions, n],
  )
  const highlightSet = useMemo(() => new Set(highlights), [highlights])

  if (!n || !regions || !board) return null

  return (
    <div
      className={`${styles.board} ${solved ? styles.solved : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      role="grid"
      aria-label="Queens board"
    >
      {board.map((cell, i) => {
        const r = Math.floor(i / n), c = i % n
        const reg = regions[i]
        const color = REGION_COLORS[reg % REGION_COLORS.length]
        // Thick borders on region boundaries (and the outer edge).
        const bTop    = r === 0     || regions[i - n] !== reg
        const bBottom = r === n - 1 || regions[i + n] !== reg
        const bLeft   = c === 0     || regions[i - 1] !== reg
        const bRight  = c === n - 1 || regions[i + 1] !== reg
        const conflict = cell === 'queen' && conflicts.has(i)
        return (
          <button
            key={i}
            type="button"
            disabled={disabled && !onHighlight}
            className={`${styles.cell} ${conflict ? styles.conflict : ''} ${highlightSet.has(i) ? styles.highlight : ''}`}
            style={{
              backgroundColor: `${color}59`,   // ~35% alpha fill
              borderTopWidth: bTop ? 3 : 1,
              borderBottomWidth: bBottom ? 3 : 1,
              borderLeftWidth: bLeft ? 3 : 1,
              borderRightWidth: bRight ? 3 : 1,
            }}
            onPointerUp={(e) => { e.preventDefault(); if (onHighlight) onHighlight(i); else if (!disabled) onPlace(i, NEXT[cell] || 'empty') }}
            aria-label={`Row ${r + 1}, column ${c + 1}: ${cell}`}
          >
            {cell === 'queen' && <span className={styles.queen}>👑</span>}
            {cell === 'x' && <span className={styles.mark}>✕</span>}
          </button>
        )
      })}
    </div>
  )
}
