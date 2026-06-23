import { useState } from 'react'
import CountUp from 'react-countup'
import SpinWheel from './SpinWheel.jsx'
import PuzzleBoard from './PuzzleBoard.jsx'
import { RefreshIcon, BulbIcon, CloseIcon } from '../icons/Icons.jsx'
import styles from './SpinBattle.module.css'

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('')
const VOWELS = 'AEIOU'.split('')

// Pure presentational Spin Battle view. All state lives in the page; this just
// renders and emits intent (onSpin / onGuess / onBuyVowel / onSolve).
export default function SpinBattle({
  game, busy = false, spinning = false, spinIndex = 0, spinNonce = 0,
  feedback = '', onSpin, onGuess, onBuyVowel, onSolve, onSettle,
}) {
  const [showSolve, setShowSolve] = useState(false)
  const [solveText, setSolveText] = useState('')
  if (!game) return null

  const revealed = new Set(game.revealed || [])
  const idle = !game.canGuess && !game.over && !busy && !spinning
  const canConsonant = game.canGuess && !game.over && !busy && !spinning
  const canVowel = idle && game.bank >= game.vowelCost
  const canSolve = !game.over && !busy && !spinning

  function submitSolve(e) {
    e.preventDefault()
    if (!solveText.trim()) return
    onSolve?.(solveText.trim())
    setSolveText('')
    setShowSolve(false)
  }

  return (
    <div className={styles.wrap}>
      {/* HUD */}
      <div className={styles.hud}>
        <div className={styles.bank}>
          <span className={styles.bankLabel}>Bank</span>
          <span className={styles.bankVal}><CountUp end={game.bank} duration={0.5} preserveValue /></span>
        </div>
        <div className={styles.strikes} aria-label={`${game.strikes} of ${game.maxStrikes} strikes`}>
          {Array.from({ length: game.maxStrikes }).map((_, i) => (
            <span key={i} className={`${styles.pip} ${i < game.strikes ? styles.pipUsed : ''}`}>
              {i < game.strikes ? '✕' : '○'}
            </span>
          ))}
        </div>
      </div>

      <PuzzleBoard masked={game.masked} category={game.category} />

      <p key={feedback || (game.canGuess ? 'c' : 's')} className={styles.feedback} role="status">
        {feedback || (game.canGuess ? 'Call a consonant!' : 'Spin the wheel!')}
      </p>

      <SpinWheel
        segments={game.wheel}
        targetIndex={spinIndex}
        nonce={spinNonce}
        spinning={spinning}
        onSettle={onSettle}
      />

      {/* Primary action */}
      <button
        className={`btn btn-juice btn-lg ${styles.spinBtn} ${idle && !spinning ? styles.spinReady : ''}`}
        onClick={onSpin}
        disabled={!idle}
      >
        {spinning ? 'Spinning…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><RefreshIcon size={17} /> SPIN</span>}
      </button>

      {/* Consonant keyboard */}
      <div className={styles.keyboard}>
        {CONSONANTS.map(letter => (
          <button
            key={letter}
            className={`${styles.key} ${revealed.has(letter) ? styles.keyDone : ''}`}
            onClick={() => onGuess?.(letter)}
            disabled={!canConsonant || revealed.has(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Vowels */}
      <div className={styles.vowelRow}>
        <span className={styles.vowelHint}>Buy a vowel ({game.vowelCost})</span>
        <div className={styles.vowels}>
          {VOWELS.map(letter => (
            <button
              key={letter}
              className={`${styles.vowel} ${revealed.has(letter) ? styles.keyDone : ''}`}
              onClick={() => onBuyVowel?.(letter)}
              disabled={!canVowel || revealed.has(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Solve */}
      {!showSolve ? (
        <button className={`btn btn-ghost ${styles.solveToggle}`} onClick={() => setShowSolve(true)} disabled={!canSolve} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <BulbIcon size={16} /> Solve the puzzle
        </button>
      ) : (
        <form className={styles.solveForm} onSubmit={submitSolve}>
          <input
            className="input"
            value={solveText}
            onChange={e => setSolveText(e.target.value)}
            placeholder="Type the full answer"
            autoFocus
            maxLength={60}
          />
          <button type="submit" className="btn btn-juice" disabled={!canSolve}>Solve</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSolve(false)}><CloseIcon size={15} /></button>
        </form>
      )}
    </div>
  )
}
