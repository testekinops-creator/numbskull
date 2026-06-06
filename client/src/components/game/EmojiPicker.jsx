import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './EmojiPicker.module.css'

const EMOJIS = [
  '😂', '😈', '💀', '🔥', '👑', '🤡', '😭', '🥶', '🧠', '💩',
  '👏', '🎯', '😱', '🫡', '💪', '🤝', '👀', '🐂', '🐄', '⚡',
  '😎', '🤣', '😏', '🥳', '😤', '🙄', '😴', '🤔', '🤯', '😬',
  '🫠', '🤓', '😅', '🫣', '🙃', '😇', '🤪', '😜', '🫶', '✨',
  '💯', '🎉', '🥲', '😐', '🧊', '🐐', '🤌', '🫵', '🤖',
]

const LONG_PRESS_MS = 400

// One button that holds the currently-selected emoji.
//   • short tap  → open a portaled bottom-sheet to change the selection
//   • long-press → send the selected emoji to the opponent (onPick)
// The sheet is a centered, viewport-clamped, scrollable sheet so it is never
// clipped off-screen.
export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('😂')
  const [sent, setSent] = useState(false)
  const timerRef = useRef(null)
  const longFired = useRef(false)

  function fireSend() {
    longFired.current = true
    onPick?.(selected)
    setSent(true)
    setTimeout(() => setSent(false), 320)
    if (navigator.vibrate) { try { navigator.vibrate(18) } catch { /* noop */ } }
  }

  function startPress() {
    longFired.current = false
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fireSend, LONG_PRESS_MS)
  }
  function endPress() {
    clearTimeout(timerRef.current)
    if (!longFired.current) setOpen(o => !o) // it was a tap → toggle the sheet
  }
  function cancelPress() { clearTimeout(timerRef.current) }

  return (
    <>
      <button
        className={`${styles.trigger} ${sent ? styles.sent : ''}`}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        title="Tap to choose · hold to send"
        aria-label={`Reaction ${selected}. Tap to change, hold to send.`}
        aria-expanded={open}
        style={{ userSelect: 'none', touchAction: 'manipulation' }}
      >
        {selected}
        {sent && <span className={styles.sentRing} aria-hidden="true" />}
      </button>

      {open && createPortal(
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={`${styles.sheet} anim-slide-up`} role="dialog" aria-label="Pick a reaction">
            <div className={styles.handle} />
            <p className={styles.hint}>Pick a reaction — then <b>hold</b> the button to send it</p>
            <div className={styles.grid}>
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className={`${styles.emoji} ${e === selected ? styles.active : ''}`}
                  onClick={() => { setSelected(e); setOpen(false) }}
                  aria-label={`Choose ${e}`}
                  aria-pressed={e === selected}
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
