import { useState, useEffect } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import styles from './TutorialOverlay.module.css'  // reuse the single-player tutorial styling

// First-time multiplayer onboarding. `variant`:
//   'guess' → GTN/BC (you set a secret), 'match' → XOX/Math/Sudoku (no secret),
//   'spin'  → Spin Battle (wheel + wedges need their own explainer).
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
  spin: [
    { emoji: '🎡', title: 'Spin Battle — live', body: "You share one hidden phrase. On your turn, spin and call a consonant; correct letters bank points and keep your turn. Miss, and play passes." },
    { emoji: '🔤', title: 'Letters, vowels & solving', body: "A consonant pays its wedge value × how many appear. Buy vowels from your bank anytime. Solve the phrase on your turn to win it outright." },
    { emoji: '🎰', title: 'Wedges change everything', body: "💀 Bankrupt wipes your bank · 🛡️ Shield blocks it · 🔥/💰/🦹 load you up · ❄️ Freeze chills a rival's turn. Land smart." },
    { emoji: '💀', title: 'Talk trash', body: 'Tap 😀 to react, 💬 to chat, and 🙋 to add a friend while you play.' },
  ],
  sos: [
    { emoji: '🔠', title: 'Spell S‑O‑S', body: 'Take turns placing an S or an O. Spell S‑O‑S in any direction — across, down or diagonally — to score. Most lines when the board fills wins.' },
    { emoji: '✏️', title: 'Draw to score', body: 'When you form an S‑O‑S the board locks — drag across it (or tap it) to claim the line. Every line is +1 and another turn.' },
    { emoji: '⏱️', title: '30 seconds a turn', body: "Don't dawdle — run out of time and we play a move for you (a non-scoring one where possible), so no one can stall to dodge a tricky move." },
    { emoji: '💀', title: 'Talk trash', body: 'Tap 😀 to react, 💬 to chat, 📞 to voice-call, and 🙋 to add a friend.' },
  ],
  sudoku: [
    { emoji: '🔢', title: 'Race the grid', body: 'You and your rival fill the SAME Sudoku. Tap an empty cell, then a number. Correct cells turn YOUR colour — cyan vs pink. Claim the most.' },
    { emoji: '🔥', title: 'Combo scoring', body: 'Correct = +1, but a streak pays more: 2 in a row = +2, 3+ = +3, 5+ = +4. A wrong answer is −1 and breaks your combo. Watch the lead bar.' },
    { emoji: '⚔️', title: 'Mistakes & the finish', body: 'A wrong cell turns red — only your rival can fix it. Hit the mistake limit and you forfeit. When few cells remain, it’s a sprint!' },
    { emoji: '💀', title: 'Talk trash', body: 'Tap 😀 to react, 💬 to chat, 📞 to voice-call, and 🙋 to add a friend.' },
  ],
  rmcs: [
    { emoji: '👑', title: 'Four secret roles', body: 'Every round deals Raja (1000), Mantri (800), Sipahi (500) and Chor (0) — in secret. Tap your chit to see yours. Keep a straight face.' },
    { emoji: '📣', title: 'Two get exposed', body: 'Once all four reveal, the Raja and Mantri are announced. The other two stay hidden — one honest Sipahi, one lying Chor.' },
    { emoji: '🕵️', title: 'The Mantri hunts', body: 'The Mantri has 60s to accuse one of the two. Right: Mantri keeps 800. Wrong: the Chor ESCAPES with the 800!' },
    { emoji: '🥷', title: 'Bluff your way out', body: 'Chat and emoji stay open while the Mantri decides — mislead, provoke, deny. Highest total when the host ends wins.' },
    { emoji: '🎲', title: 'Twist rounds', body: 'After round 1, rounds can flip the stakes: 💰 Jackpot doubles points, ⚡ Sudden Death triples them, 🥷 Double Steal lets an escaping Chor rob the Raja too, and 🤫 Silent locks all table talk. Watch the banner.' },
  ],
}

export default function MultiplayerTutorial({ variant = 'guess', onDone }) {
  const KEY = `ns_mp_tut_${variant}`
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const trapRef = useFocusTrap(visible)  // hook must run unconditionally (before any early return)

  useEffect(() => { if (!localStorage.getItem(KEY)) setVisible(true) }, [KEY])

  if (!visible) return null
  const steps = STEPS[variant] || STEPS.guess
  const cur = steps[step]

  function next() { step < steps.length - 1 ? setStep(s => s + 1) : dismiss() }
  function dismiss() { localStorage.setItem(KEY, '1'); setVisible(false); onDone?.() }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="How multiplayer works">
      <div ref={trapRef} className={`${styles.panel} anim-bounce-land`}>
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
