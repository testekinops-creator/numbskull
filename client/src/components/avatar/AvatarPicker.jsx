import { AVATARS } from '../../utils/avatars.js'
import Avatar from './Avatar.jsx'
import styles from './AvatarPicker.module.css'

// A scrollable grid of avatar choices. `value` is the current id; `onPick(id)`
// fires on selection.
export default function AvatarPicker({ value, onPick }) {
  return (
    <div className={styles.grid} role="radiogroup" aria-label="Choose an avatar">
      {AVATARS.map(a => {
        const selected = a.id === value
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={a.id}
            className={`${styles.cell} ${selected ? styles.selected : ''}`}
            onClick={() => onPick?.(a.id)}
          >
            <Avatar id={a.id} size={48} />
          </button>
        )
      })}
    </div>
  )
}
