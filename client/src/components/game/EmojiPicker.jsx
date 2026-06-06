import { useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './EmojiPicker.module.css'

const EMOJIS = [
  '😂', '😈', '💀', '🔥', '👑', '🤡', '😭', '🥶', '🧠', '💩',
  '👏', '🎯', '😱', '🫡', '💪', '🤝', '👀', '🐂', '🐄', '⚡',
  '😎', '🤣', '😏', '🥳', '😤', '🙄', '😴', '🤔', '🤯', '😬',
  '🫠', '🤓', '😅', '🫣', '🙃', '😇', '🤪', '😜', '🫶', '✨',
  '💯', '🎉', '🥲', '😐', '🧊', '🐐', '🤌', '🫵', '🤖',
]

// A single trigger that opens a portaled bottom-sheet of emojis (replaces the
// long inline row). Portaled so no transformed ancestor can clip it.
export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-label="Emoji reactions"
        aria-expanded={open}
      >
        😀
      </button>

      {open && createPortal(
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`${styles.sheet} anim-slide-up`} role="dialog" aria-label="Pick an emoji">
            <div className={styles.handle} />
            <div className={styles.grid}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className={styles.emoji}
                  onClick={() => { onPick(e); setOpen(false) }}
                  aria-label={`Send ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
