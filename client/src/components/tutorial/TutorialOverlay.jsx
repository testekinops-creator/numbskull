import { useState, useEffect } from 'react'
import styles from './TutorialOverlay.module.css'

const STEPS = {
  GTN: [
    {
      title: "Guess The Number",
      body: "I'm thinking of a number between 1 and 1000. Can you guess it? (Probably not.)",
      emoji: "🎯",
    },
    {
      title: "I'll give you hints",
      body: "After each guess I'll tell you whether to go higher or lower. I'll also play a note — higher pitch means you're closer.",
      emoji: "🎵",
    },
    {
      title: "Less is more",
      body: "The optimal strategy takes at most 10 guesses. How many will you waste? I'm counting.",
      emoji: "🧮",
    },
  ],
  BC: [
    {
      title: "Bulls & Cows",
      body: "I've chosen a 6-digit code — digits can repeat. Your job is to crack it. Good luck. You'll need it.",
      emoji: "🐂",
    },
    {
      title: "Bulls & Cows scoring",
      body: "🐂 Bull = right digit, right position (it gets highlighted). 🐄 Cow = a digit is in the code but in the wrong spot. 6 bulls = you win.",
      emoji: "📊",
    },
    {
      title: "Crack the code",
      body: "Repeats are allowed, so think carefully. I'll only tell you which digits are locked in — not where the rest belong.",
      emoji: "🔢",
    },
  ],
  XOX: [
    {
      title: "Tic-Tac-Toe",
      body: "Old game, same humiliation. Get three of your marks in a row — across, down, or diagonally — before your opponent does.",
      emoji: "⭕",
    },
    {
      title: "Take turns",
      body: "X always moves first. Tap any empty square on your turn. Don't take too long — stall and you forfeit.",
      emoji: "⏱️",
    },
    {
      title: "Three in a row wins",
      body: "Line up three and it's yours. Fill the board with nobody winning and it's a draw. Against me on Hard? Good luck drawing.",
      emoji: "🏆",
    },
  ],
}

const STORAGE_KEY = 'ns_tutorial_done'

export default function TutorialOverlay({ mode, onDone }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(`${STORAGE_KEY}_${mode}`)
    if (!done) setVisible(true)
  }, [mode])

  if (!visible) return null

  const steps = STEPS[mode] || []
  const current = steps[step]

  function next() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function dismiss() {
    localStorage.setItem(`${STORAGE_KEY}_${mode}`, '1')
    setVisible(false)
    onDone?.()
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="How to play">
      <div className={`${styles.panel} card anim-bounce-land`}>
        <div className={styles.progress}>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.active : ''} ${i < step ? styles.done : ''}`}
            />
          ))}
        </div>

        <div className={styles.emoji}>{current.emoji}</div>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.actions}>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>
            Skip
          </button>
          <button className="btn btn-juice" onClick={next}>
            {step < steps.length - 1 ? 'Next' : "Let's go"}
          </button>
        </div>
      </div>
    </div>
  )
}
