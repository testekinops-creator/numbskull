import { conflictsOf } from '../../utils/sudoku.js'
import styles from './SudokuGrid.module.css'

// Presentational 9×9 Sudoku board — shared by solo and multiplayer. It owns the
// live-assist visuals (peers / same-number / rule conflicts) but no game logic:
// the consumer supplies values, statuses, a `selectable` predicate and `onSelect`.
//
// Props:
//   grid        number[81]   — 0 = empty
//   given       bool[81]
//   status      string[81]   — 'empty' | 'given' | 'correct' | 'wrong'
//   selected    number|null
//   onSelect(i)              — tap handler
//   selectable(i) -> bool    — consumer decides which cells accept a tap
//   notes       {i: number[]}        (optional, solo) — pencil candidates for empty cells
//   correctOwner (id|null)[81]       (optional, MP)   — who claimed each correct cell
//   wrongOwner   (id|null)[81]       (optional, MP)
//   editLock    {i: ownerId}         (optional, MP)   — cell being edited by someone
//   playerId    string               (optional, MP)   — "me" for owner tints / locks
//   hintCell    number|null          (optional, solo) — cell to pulse after a hint
export default function SudokuGrid({
  grid, given, status, selected, onSelect, selectable = () => true,
  notes = null, correctOwner = null, wrongOwner = null, editLock = null,
  playerId = null, hintCell = null,
}) {
  if (!grid) return null

  const conflicts = conflictsOf(grid)
  const selRow = selected != null ? Math.floor(selected / 9) : -1
  const selCol = selected != null ? selected % 9 : -1
  const selBox = selected != null ? Math.floor(selRow / 3) * 3 + Math.floor(selCol / 3) : -1
  const selVal = selected != null ? grid[selected] : 0

  function isPeer(i) {
    if (selected == null || i === selected) return false
    const r = Math.floor(i / 9), c = i % 9
    return r === selRow || c === selCol || (Math.floor(r / 3) * 3 + Math.floor(c / 3)) === selBox
  }

  return (
    <div className={styles.grid} role="grid" aria-label="Sudoku board">
      {grid.map((v, i) => {
        const col = i % 9, row = Math.floor(i / 9)
        const st = status[i]
        const isSel    = i === selected
        const oppLock  = editLock && editLock[i] && editLock[i] !== playerId
        const peerTint = isPeer(i) && !given[i] && st === 'empty'
        const sameNum  = selVal !== 0 && v === selVal && i !== selected
        // Territory: tint a correct cell by who claimed it (MP). Solo passes no
        // owner array → correct cells fall back to the neutral "correct" colour.
        let ownerCls = ''
        if (st === 'correct' && correctOwner) {
          ownerCls = correctOwner[i] === playerId ? styles.mine : styles.theirs
        }
        const cellNotes = (!v && notes && notes[i] && notes[i].length) ? notes[i] : null

        const cls = [
          styles.cell,
          given[i] ? styles.given : '',
          st === 'correct' ? styles.correct : '',
          st === 'wrong' ? styles.wrong : '',
          ownerCls,
          isSel ? styles.selected : '',
          oppLock ? styles.oppLock : '',
          peerTint ? styles.peer : '',
          sameNum ? styles.sameNum : '',
          conflicts.has(i) ? styles.conflict : '',
          hintCell === i ? styles.hintPulse : '',
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
            onClick={() => onSelect?.(i)}
            disabled={!selectable(i)}
            aria-label={`Cell ${i + 1}${v ? `, ${v}` : ', empty'}`}
          >
            {v !== 0 ? (
              v
            ) : cellNotes ? (
              <span className={styles.notes} aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <span key={n} className={styles.note}>{cellNotes.includes(n) ? n : ''}</span>
                ))}
              </span>
            ) : ''}
          </button>
        )
      })}
    </div>
  )
}
