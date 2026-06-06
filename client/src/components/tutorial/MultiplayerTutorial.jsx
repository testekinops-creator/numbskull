import { useState, useEffect } from 'react'
import styles from './TutorialOverlay.module.css'  // reuse the single-player tutorial styling

// First-time multiplayer onboarding. `variant`:
//   'guess' → GTN/BC (you set a secret), 'match' → XOX/Math/Sudoku (no secret).
// Each variant shows once (separate localStorage flags).
const STEPS = {
  guess: [
    { emoji: '🔒', title: 'Set your secret', body: "Pick a secret number or code. Your opponent tries to crack it — and you crack theirs." },
    { emoji: '✅', title: 'Ready up', body: 'When both players are ready, the game starts. Who goes first alternates each round.' },
    { emoji: '🔁', title: 'Take turns', body: 'Guess on your turn. Crack their secret before they crack yours to win.' },
    { emoji: '💀', title: 'Talk trash', body: 'Tap 😀 to react, 💬 to chat, 📞 to voice-call, and 🙋 to add a friend.' },
  ],
  match: [
    { emoji: '⚔️', title: 'Real-time duel', body: "No secret to set — the match starts the moment you both join. Play live." },
    { emoji: '🏆', title: 'Win the round', body: 'Outplay your opponent. Wins count toward the monthly leaderboard.' },
    { emoji: '💀', title: 'Talk trash', body: 'Tap 😀 to react, 💬 to chat, 📞 to voice-call, and 🙋 to add a friend.' },
  ],
}

export default function MultiplayerTutorial({ variant = 'guess', onDone }) {
  const KEY = variant === 'match' ? 'ns_mp_tut_match' : 'ns_mp_tut_guess'
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => { if (!localStorage.getItem(KEY)) setVisible(true) }, [KEY])

  if (!visible) return null
  const steps = STEPS[variant] || STEPS.guess
  const cur = steps[step]

  function next() { step < steps.length - 1 ? setStep(s => s + 1) : dismiss() }
  function dismiss() { localStorage.setItem(KEY, '1'); setVisible(false); onDone?.() }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="How multiplayer works">
      <div className={`${styles.panel} card anim-bounce-land`}>
        <div className={styles.progress}>
          {steps.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === step ? styles.active : ''} ${i < step ? styles.done : ''}`} />
          ))}
        </div>
        <div className={styles.emoji}>{cur.emoji}</div>
        <h2 className={styles.title}>{cur.title}</h2>
        <p className={styles.body}>{cur.body}</p>
        <div className={styles.actions}>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>Skip</button>
          <button className="btn btn-juice" onClick={next}>
            {step < steps.length - 1 ? 'Next' : "Got it!"}
          </button>
        </div>
      </div>
    </div>
  )
}
