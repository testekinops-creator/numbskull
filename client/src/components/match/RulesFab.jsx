import { useState, useEffect } from 'react'
import RulesModal from './RulesModal.jsx'
import s from './RulesFab.module.css'

// Floating "How to play" button shown in every multiplayer room. On entry it
// briefly blinks and shows a tooltip so players notice it; the hint auto-dismisses
// (or clears the moment it's tapped). Opening the modal locks background scroll.
export default function RulesFab({ mode }) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(true)

  // Attention hint fades after a few seconds.
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <div className={s.wrap}>
        {hint && <span className={s.tip}>Tap for how to play</span>}
        <button
          className={`${s.fab} ${hint ? s.blink : ''}`}
          onClick={() => { setOpen(true); setHint(false) }}
          aria-label="How to play"
          title="How to play"
        >
          ?
        </button>
      </div>
      {open && <RulesModal mode={mode} onClose={() => setOpen(false)} />}
    </>
  )
}
