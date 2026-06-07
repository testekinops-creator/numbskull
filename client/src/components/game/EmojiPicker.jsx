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

// Live-reaction picker (premium one-tap pattern). Tap the button to open a
// portaled, viewport-clamped panel; tapping any emoji sends it to the opponent
// instantly and the panel stays open for rapid reactions. Tap outside to close.
export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false)
  const [justSent, setJustSent] = useState(null)

  function send(e) {
    onPick?.(e)
    setJustSent(e)
    setTimeout(() => setJustSent(null), 350)
    if (navigator.vibrate) { try { navigator.vibrate(12) } catch { /* noop */ } }
  }

  return (
    <>
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-label="Send a reaction"
        aria-expanded={open}
      >
        😀
      </button>

      {open && createPortal(
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`${styles.sheet} anim-slide-up`} role="dialog" aria-label="Send a reaction">
            <div className={styles.handle} />
            <p className={styles.hint}>Tap to send a reaction</p>
            <div className={styles.grid}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className={`${styles.emoji} ${justSent === e ? styles.pop : ''}`}
                  onClick={() => send(e)}
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
