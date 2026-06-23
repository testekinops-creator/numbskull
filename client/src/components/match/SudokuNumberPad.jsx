import { EditIcon, BulbIcon } from '../icons/Icons.jsx'
import styles from './SudokuNumberPad.module.css'

// Premium Sudoku number pad — shared by solo and multiplayer. Numbers 1–9 plus
// an optional action row. The consumer opts into each control by passing its
// handler; anything without a handler simply isn't rendered.
//
// Props:
//   onNumber(n)              — required
//   selected   bool          — is a cell selected? (gates the whole pad)
//   remaining  {n: count}    (optional) — show how many of each digit are left; dim at 0
//   notesMode  bool          (optional) + onToggleNotes() — show the ✏️ notes toggle
//   onUndo()   / undoEnabled (optional) — show an Undo control
//   onHint()   / hintsLeft   (optional) — show a Hint control with a remaining badge
//   onClear()  / clearEnabled(optional) — show a Clear control
export default function SudokuNumberPad({
  onNumber, selected = true,
  remaining = null,
  notesMode = false, onToggleNotes = null,
  onUndo = null, undoEnabled = true,
  onHint = null, hintsLeft = null,
  onClear = null, clearEnabled = true,
}) {
  const hasActions = onToggleNotes || onUndo || onHint || onClear

  return (
    <div className={styles.pad}>
      <div className={styles.numbers}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
          const left = remaining ? remaining[n] ?? 0 : null
          const done = remaining && left <= 0
          return (
            <button
              key={n}
              type="button"
              className={`${styles.num} ${notesMode ? styles.numNotes : ''} ${done ? styles.numDone : ''}`}
              onClick={() => onNumber?.(n)}
              disabled={!selected || done}
              aria-label={`Enter ${n}${left != null ? `, ${left} left` : ''}`}
            >
              <span className={styles.numVal}>{n}</span>
              {left != null && <span className={styles.numLeft}>{Math.max(0, left)}</span>}
            </button>
          )
        })}
      </div>

      {hasActions && (
        <div className={styles.actions}>
          {onToggleNotes && (
            <button
              type="button"
              className={`${styles.action} ${notesMode ? styles.actionOn : ''}`}
              onClick={onToggleNotes}
              aria-pressed={notesMode}
              title="Pencil notes"
            >
              <span className={styles.actionIcon}><EditIcon size={18} /></span>
              <span className={styles.actionLabel}>Notes{notesMode ? ' • On' : ''}</span>
            </button>
          )}
          {onUndo && (
            <button type="button" className={styles.action} onClick={onUndo} disabled={!undoEnabled} title="Undo">
              <span className={styles.actionIcon}>↶</span>
              <span className={styles.actionLabel}>Undo</span>
            </button>
          )}
          {onHint && (
            <button type="button" className={styles.action} onClick={onHint} disabled={hintsLeft != null && hintsLeft <= 0} title="Hint">
              <span className={styles.actionIcon}><BulbIcon size={18} /></span>
              <span className={styles.actionLabel}>Hint</span>
              {hintsLeft != null && <span className={styles.actionBadge}>{hintsLeft}</span>}
            </button>
          )}
          {onClear && (
            <button type="button" className={styles.action} onClick={onClear} disabled={!clearEnabled} title="Clear cell">
              <span className={styles.actionIcon}>⌫</span>
              <span className={styles.actionLabel}>Clear</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
