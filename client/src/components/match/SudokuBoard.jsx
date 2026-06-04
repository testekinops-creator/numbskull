import { useState, useRef, useEffect } from 'react'
import styles from './SudokuBoard.module.css'

// Collaborative Sudoku board. `match` carries grid/given/status/wrongOwner/
// editLock/scores. All edits go through the on* handlers (server-authoritative).
export default function SudokuBoard({ match, playerId, opponentId, onLock, onUnlock, onFill, onClear }) {
  const [selected, setSelected] = useState(null)
  const selRef = useRef(null)
  selRef.current = selected

  // Release my lock when leaving the board.
  useEffect(() => () => { if (selRef.current != null) onUnlock?.(selRef.current) }, []) // eslint-disable-line

  if (!match?.grid) return null
  const { grid, given, status, wrongOwner, editLock = {} } = match

  function selectable(i) {
    if (given[i] || status[i] === 'correct') return false
    const lock = editLock[i]
    if (lock && lock !== playerId) return false   // opponent is editing
    return true
  }

  function tapCell(i) {
    if (!selectable(i)) return
    if (selected != null && selected !== i) onUnlock?.(selected)
    setSelected(i)
    onLock?.(i)
  }

  function tapNumber(n) {
    if (selected == null) return
    onFill?.(selected, n)
  }

  function tapClear() {
    if (selected == null) return
    if (status[selected] === 'wrong') onClear?.(selected)
  }

  const myWrongSelected = selected != null && status[selected] === 'wrong' && wrongOwner[selected] === playerId

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} role="grid" aria-label="Sudoku board">
        {grid.map((v, i) => {
          const isSel   = i === selected
          const oppLock = editLock[i] && editLock[i] !== playerId
          const col = i % 9, row = Math.floor(i / 9)
          const cls = [
            styles.cell,
            given[i] ? styles.given : '',
            status[i] === 'correct' ? styles.correct : '',
            status[i] === 'wrong' ? styles.wrong : '',
            isSel ? styles.selected : '',
            oppLock ? styles.oppLock : '',
            // Single-line grid: cells draw only top+left; the grid frame draws
            // the outer right/bottom. First row/col skip their line (frame does
            // it); the 3×3 box separators thicken the internal line once.
            col === 0 ? styles.firstCol : '',
            row === 0 ? styles.firstRow : '',
            (col === 3 || col === 6) ? styles.boxV : '',
            (row === 3 || row === 6) ? styles.boxH : '',
          ].join(' ')
          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => tapCell(i)}
              disabled={!selectable(i)}
              aria-label={`Cell ${i + 1}${v ? `, ${v}` : ', empty'}`}
            >
              {v !== 0 ? v : ''}
            </button>
          )
        })}
      </div>

      {/* Number pad */}
      <div className={styles.pad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button key={n} className={styles.num} onClick={() => tapNumber(n)} disabled={selected == null}>
            {n}
          </button>
        ))}
        <button className={styles.clear} onClick={tapClear} disabled={selected == null || status[selected] !== 'wrong'}>
          ⌫ Clear
        </button>
      </div>

      {myWrongSelected && (
        <p className={styles.hint}>That cell is wrong — your partner can fix it, or clear it after a moment.</p>
      )}
    </div>
  )
}
