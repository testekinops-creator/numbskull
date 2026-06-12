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
  MATH: [
    {
      title: "Math Battle",
      body: "20 questions. You and your rival see the same one at the same time. First to lock in an answer takes the question.",
      emoji: "🧮",
    },
    {
      title: "Right AND fast",
      body: "Correct = +1 for you. Wrong = −1 for you AND +1 for your rival. So a careless buzz literally hands them the lead — don't just mash buttons.",
      emoji: "⚡",
    },
    {
      title: "Highest score wins",
      body: "After 20 questions, the higher score wins. Tie? It's a draw. Now stop reading and start adding.",
      emoji: "🏆",
    },
  ],
  SPIN: [
    {
      title: "Spin Battle",
      body: "There's a hidden phrase up top, shown as blanks. Crack every letter — or just guess the whole thing — before five strikes wipe you out.",
      emoji: "🎡",
    },
    {
      title: "Spin, then call a consonant",
      body: "Spin the wheel to set a point value, then call a consonant. Each one in the phrase pays that value × how many times it appears. Call one that isn't there and it's a strike.",
      emoji: "🔤",
    },
    {
      title: "Buy vowels · solve anytime",
      body: "A, E, I, O, U cost from your bank — no spin needed. Think you've got it? Hit Solve and type the phrase. Right = you win; wrong = a strike.",
      emoji: "💡",
    },
    {
      title: "Watch the wedges",
      body: "💀 Bankrupt wipes your bank. 🔥 Double / 💰 Jackpot / 🦹 Steal load you up. 🛡️ Shield blocks the next Bankrupt. Lose-a-turn just stings. Land smart, spend smart.",
      emoji: "🎰",
    },
  ],
  SUDOKU: [
    {
      title: "Sudoku",
      body: "Fill the grid so every row, every column and every 3×3 box contains 1–9. Tap an empty cell, then a number.",
      emoji: "🔢",
    },
    {
      title: "Three lives",
      body: "A wrong number flashes red and costs a heart. Three mistakes and the run is over — so read the board before you tap.",
      emoji: "❤️",
    },
    {
      title: "Notes · hints · undo",
      body: "Toggle ✏️ to pencil in candidates, tap 💡 for a hint (3 per puzzle) and ↶ to undo. Solve it fast to beat your best time on each difficulty.",
      emoji: "💡",
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
      <div className={`${styles.panel} anim-bounce-land`}>
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
