import styles from './XoxBoard.module.css'
import { useHaptic } from '../../hooks/useHaptic.js'

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function winningLine(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line
  }
  return null
}

// Cell centre as a % of the board, for the SVG strike-line overlay.
const centerOf = (i) => ({ x: ((i % 3) + 0.5) / 3 * 100, y: (Math.floor(i / 3) + 0.5) / 3 * 100 })

// Pure presentational 3×3 board. `board` is a 9-cell array of 'X' | 'O' | null.
export default function XoxBoard({ board = Array(9).fill(null), onCell, disabled, lastCell }) {
  const win = winningLine(board)
  const { buzz } = useHaptic()

  return (
    <div className={styles.board} role="grid" aria-label="Tic-Tac-Toe board">
      {board.map((cell, i) => {
        const isWin  = win?.includes(i)
        const isLast = lastCell === i && cell
        return (
          <button
            key={i}
            type="button"
            className={[
              styles.cell,
              cell === 'X' ? styles.markX : '',
              cell === 'O' ? styles.markO : '',
              isWin ? styles.winCell : '',
              isLast ? styles.lastCell : '',
            ].join(' ')}
            onClick={() => { buzz('tap'); onCell?.(i) }}
            disabled={disabled || cell !== null}
            aria-label={`Square ${i + 1}${cell ? `, ${cell}` : ', empty'}`}
          >
            {cell && <span className={styles.markGlyph}>{cell}</span>}
          </button>
        )
      })}

      {/* Winning strike-through — draws itself across the three cells. */}
      {win && (() => {
        const a = centerOf(win[0]), b = centerOf(win[2])
        const winner = board[win[0]]
        return (
          <svg className={styles.strikeOverlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={`${styles.strikeLine} ${winner === 'X' ? styles.strikeX : styles.strikeO}`}
            />
          </svg>
        )
      })()}
    </div>
  )
}
