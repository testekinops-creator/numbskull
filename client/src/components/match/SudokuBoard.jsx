import { useState, useRef, useEffect } from 'react'
import styles from './SudokuBoard.module.css'
import { useHaptic } from '../../hooks/useHaptic.js'

// Collaborative Sudoku board. `match` carries grid/given/status/wrongOwner/
// editLock/scores. All edits go through the on* handlers (server-authoritative).
export default function SudokuBoard({ match, playerId, opponentId, onLock, onUnlock, onFill, onClear }) {
  const [selected, setSelected] = useState(null)
  const selRef = useRef(null)
  selRef.current = selected
  const { buzz } = useHaptic()

  // Release my lock when leaving the board.
  useEffect(() => () => { if (selRef.current != null) onUnlock?.(selRef.current) }, []) // eslint-disable-line

  if (!match?.grid) return null
  const { grid, given, status, wrongOwner, editLock = {} } = match

  // ── Live assistance (purely client-side, no server involvement) ──────────
  // 1) Conflicts: any filled value duplicated within its row / column / 3×3 box.
  const conflicts = computeConflicts(grid)
  // 2) Peers of the selected cell (same row/col/box) + cells sharing its value.
  const selRow = selected != null ? Math.floor(selected / 9) : -1
  const selCol = selected != null ? selected % 9 : -1
  const selBox = selected != null ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1
  const selVal = selected != null ? grid[selected] : 0
  function isPeer(i) {
    if (selected == null || i === selected) return false
    const r = Math.floor(i / 9), c = i % 9
    return r === selRow || c === selCol || (Math.floor(r / 3) * 3 + Math.floor(c / 3)) === selBox
  }

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
    buzz('tap')
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
          // Peer tint only on empty editable cells, so it never fights a filled
          // cell's solid colour. same-number + conflict use rings (coexist).
          const peerTint = isPeer(i) && !given[i] && status[i] === 'empty'
          const sameNum  = selVal !== 0 && v === selVal && i !== selected
          const cls = [
            styles.cell,
            given[i] ? styles.given : '',
            status[i] === 'correct' ? styles.correct : '',
            status[i] === 'wrong' ? styles.wrong : '',
            isSel ? styles.selected : '',
            oppLock ? styles.oppLock : '',
            peerTint ? styles.peer : '',
            sameNum ? styles.sameNum : '',
            conflicts.has(i) ? styles.conflict : '',
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

// Indices of cells whose value is duplicated within their row, column, or box.
function computeConflicts(grid) {
  const conflict = new Set()
  const scan = (cells) => {
    const seen = {}
    for (const i of cells) {
      const v = grid[i]
      if (!v) continue
      if (seen[v] != null) { conflict.add(i); conflict.add(seen[v]) }
      else seen[v] = i
    }
  }
  for (let r = 0; r < 9; r++) scan(Array.from({ length: 9 }, (_, c) => r * 9 + c))           // rows
  for (let c = 0; c < 9; c++) scan(Array.from({ length: 9 }, (_, r) => r * 9 + c))           // columns
  for (let b = 0; b < 9; b++) {                                                              // 3×3 boxes
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3
    scan(Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + (bc + k % 3)))
  }
  return conflict
}
