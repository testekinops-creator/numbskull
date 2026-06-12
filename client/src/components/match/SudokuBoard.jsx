import { useState, useRef, useEffect } from 'react'
import SudokuGrid from './SudokuGrid.jsx'
import SudokuNumberPad from './SudokuNumberPad.jsx'
import { useHaptic } from '../../hooks/useHaptic.js'
import styles from './SudokuBoard.module.css'

// Multiplayer (collaborative-race) Sudoku board. Thin wrapper over the shared
// premium SudokuGrid + SudokuNumberPad — this file owns only the MP wiring:
// edit-locks, cell ownership and the cross-fix rule. `match` carries grid/given/
// status/wrongOwner/correctOwner/editLock/scores (server-authoritative).
export default function SudokuBoard({ match, playerId, opponentId, onLock, onUnlock, onFill, onClear }) {
  const [selected, setSelected] = useState(null)
  const selRef = useRef(null)
  selRef.current = selected
  const { buzz } = useHaptic()

  // Release my lock when leaving the board.
  useEffect(() => () => { if (selRef.current != null) onUnlock?.(selRef.current) }, []) // eslint-disable-line

  if (!match?.grid) return null
  const { grid, given, status, wrongOwner, correctOwner = null, editLock = {} } = match

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
      <SudokuGrid
        grid={grid}
        given={given}
        status={status}
        selected={selected}
        onSelect={tapCell}
        selectable={selectable}
        correctOwner={correctOwner}
        wrongOwner={wrongOwner}
        editLock={editLock}
        playerId={playerId}
      />

      <SudokuNumberPad
        onNumber={tapNumber}
        selected={selected != null}
        onClear={tapClear}
        clearEnabled={selected != null && status[selected] === 'wrong'}
      />

      {myWrongSelected && (
        <p className={styles.hint}>That cell is wrong — your partner can fix it, or clear it after a moment.</p>
      )}
    </div>
  )
}
