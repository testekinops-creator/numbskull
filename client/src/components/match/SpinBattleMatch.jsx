import { useState, useEffect } from 'react'
import CountUp from 'react-countup'
import SpinWheel, { SPIN_MS } from './SpinWheel.jsx'
import PuzzleBoard from './PuzzleBoard.jsx'
import s from './SpinBattle.module.css'
import m from './SpinBattleMatch.module.css'

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('')
const VOWELS = 'AEIOU'.split('')

function wedgeWord(w) {
  if (w === 'BANKRUPT') return 'BANKRUPT'
  if (w === 'LOSE_TURN') return 'LOSE A TURN'
  if (w === 'EXTRA_TURN') return '+200'
  return String(w)
}

// Multiplayer (turn-based) Spin Battle. State comes from RoomContext; this view
// renders + emits intent and only enables controls on the local player's turn.
export default function SpinBattleMatch({
  match, you, opponent, spin, onSpin, onGuess, onBuyVowel, onSolve,
}) {
  const [spinning, setSpinning] = useState(false)
  const [showSolve, setShowSolve] = useState(false)
  const [solveText, setSolveText] = useState('')

  // Animate the wheel whenever ANY player spins (nonce bumps on event 'spin').
  useEffect(() => {
    if (spin?.event === 'spin' && spin?.nonce) {
      setSpinning(true)
      const t = setTimeout(() => setSpinning(false), SPIN_MS)
      return () => clearTimeout(t)
    }
  }, [spin?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!match) return null
  const oppId = opponent?.id
  const oppName = opponent?.name || 'Opponent'
  const myTurn = match.turnId === you
  const revealed = new Set(match.revealed || [])
  const roundOver = match.roundOver

  const active = myTurn && !spinning && !roundOver
  const canSpin = active && !match.canGuess
  const canConsonant = active && match.canGuess
  const canVowel = active && !match.canGuess && (match.bank?.[you] || 0) >= match.vowelCost
  const canSolve = active

  // Feedback line from the latest event.
  const who = spin?.by === you ? 'You' : oppName
  let feedback = myTurn ? 'Your turn' : `${oppName} is playing…`
  if (spinning) feedback = `${who} ${who === 'You' ? 'are' : 'is'} spinning…`
  else if (spin?.event === 'spin') {
    feedback = spin.effect === 'bankrupt' ? `💀 ${who} hit Bankrupt!`
      : spin.effect === 'lose_turn' ? `${who} lost a turn`
      : spin.effect === 'extra_turn' ? `🎁 ${who} got +200!`
      : `${who} spun ${wedgeWord(spin.wedge)} — pick a consonant`
  } else if (spin?.event === 'guess') {
    feedback = spin.correct ? `${who} found ${spin.count}× "${spin.letter}" (+${spin.points})`
      : `No "${spin.letter}" — turn passes`
  } else if (spin?.event === 'vowel') {
    feedback = spin.correct ? `${who} bought "${spin.letter}" (×${spin.count})` : `No "${spin.letter}"`
  } else if (spin?.event === 'solve') {
    feedback = `${who} guessed wrong — turn passes`
  } else if (spin?.event === 'roundover') {
    const winName = spin.winnerId === you ? 'You' : oppName
    feedback = `🎉 ${winName} won the round!`
  } else if (spin?.event === 'newround') {
    feedback = `Round ${spin.round}!`
  }

  function submitSolve(e) {
    e.preventDefault()
    if (!solveText.trim()) return
    onSolve?.(solveText.trim())
    setSolveText(''); setShowSolve(false)
  }

  const dots = (count) => Array.from({ length: Math.ceil(match.bestOf / 2) }).map((_, i) => (
    <span key={i} className={`${m.roundDot} ${i < count ? m.roundDotWon : ''}`} />
  ))

  return (
    <div className={s.wrap}>
      {/* Scoreboard */}
      <div className={m.scoreboard}>
        <div className={`${m.side} ${myTurn ? m.sideActive : ''}`}>
          <span className={m.sideName}>You</span>
          <span className={m.sideBank}><CountUp end={match.bank?.[you] || 0} duration={0.4} preserveValue /></span>
          <span className={m.rounds}>{dots(match.roundWins?.[you] || 0)}</span>
        </div>
        <div className={m.middle}>
          <span className={m.roundLabel}>Round {match.round}</span>
          <span className={m.vs}>VS</span>
        </div>
        <div className={`${m.side} ${!myTurn ? m.sideActive : ''}`}>
          <span className={m.sideName}>{oppName}</span>
          <span className={m.sideBank}><CountUp end={oppId ? (match.bank?.[oppId] || 0) : 0} duration={0.4} preserveValue /></span>
          <span className={m.rounds}>{dots(oppId ? (match.roundWins?.[oppId] || 0) : 0)}</span>
        </div>
      </div>

      <PuzzleBoard masked={match.masked} category={match.category} />

      <p className={`${s.feedback} ${myTurn ? m.yourTurn : ''}`} role="status">{feedback}</p>

      <SpinWheel
        segments={match.wheel}
        targetIndex={spin?.index || 0}
        nonce={spin?.nonce || 0}
        spinning={spinning}
      />

      <button className={`btn btn-juice btn-lg ${s.spinBtn}`} onClick={onSpin} disabled={!canSpin}>
        {spinning ? 'Spinning…' : myTurn ? '🎡 SPIN' : 'Opponent’s turn'}
      </button>

      <div className={s.keyboard}>
        {CONSONANTS.map(letter => (
          <button
            key={letter}
            className={`${s.key} ${revealed.has(letter) ? s.keyDone : ''}`}
            onClick={() => onGuess?.(letter)}
            disabled={!canConsonant || revealed.has(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className={s.vowelRow}>
        <span className={s.vowelHint}>Buy a vowel ({match.vowelCost})</span>
        <div className={s.vowels}>
          {VOWELS.map(letter => (
            <button
              key={letter}
              className={`${s.vowel} ${revealed.has(letter) ? s.keyDone : ''}`}
              onClick={() => onBuyVowel?.(letter)}
              disabled={!canVowel || revealed.has(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {!showSolve ? (
        <button className={`btn btn-ghost ${s.solveToggle}`} onClick={() => setShowSolve(true)} disabled={!canSolve}>
          💡 Solve the puzzle
        </button>
      ) : (
        <form className={s.solveForm} onSubmit={submitSolve}>
          <input className="input" value={solveText} onChange={e => setSolveText(e.target.value)} placeholder="Type the full answer" autoFocus maxLength={60} />
          <button type="submit" className="btn btn-juice" disabled={!canSolve}>Solve</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSolve(false)}>✕</button>
        </form>
      )}
    </div>
  )
}
