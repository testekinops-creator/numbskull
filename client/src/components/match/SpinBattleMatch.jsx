import { useState, useEffect } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
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
  match, you, players = [], opponent, spin, onSpin, onGuess, onBuyVowel, onSolve,
}) {
  const [spinning, setSpinning] = useState(false)
  const [showSolve, setShowSolve] = useState(false)
  const [solveText, setSolveText] = useState('')
  const [rosterRef] = useAutoAnimate()

  // Animate the wheel whenever ANY player spins (nonce bumps on event 'spin').
  useEffect(() => {
    if (spin?.event === 'spin' && spin?.nonce) {
      setSpinning(true)
      const t = setTimeout(() => setSpinning(false), SPIN_MS)
      return () => clearTimeout(t)
    }
  }, [spin?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!match) return null
  const everyone = players && players.length
    ? players
    : [{ id: you, name: 'You' }, ...(opponent ? [opponent] : [])]
  const others = everyone.filter(p => p.id !== you)
  const isMulti = everyone.length > 2
  const nameOf = (id) => (id === you ? 'You' : (everyone.find(p => p.id === id)?.name || 'Opponent'))
  const oppId = others[0]?.id
  const oppName = others[0]?.name || 'Opponent'
  const myTurn = match.turnId === you
  const revealed = new Set(match.revealed || [])
  const roundOver = match.roundOver

  const active = myTurn && !spinning && !roundOver
  const canSpin = active && !match.canGuess
  const canConsonant = active && match.canGuess
  const canVowel = active && !match.canGuess && (match.bank?.[you] || 0) >= match.vowelCost
  const canSolve = active

  // Feedback line from the latest event.
  const who = spin?.by === you ? 'You' : nameOf(spin?.by)
  let feedback = myTurn ? 'Your turn' : `${nameOf(match.turnId)} is playing…`
  if (spinning) feedback = `${who} ${who === 'You' ? 'are' : 'is'} spinning…`
  else if (spin?.event === 'spin') {
    feedback = spin.effect === 'bankrupt' ? `💀 ${who} hit Bankrupt!`
      : spin.effect === 'bankrupt_blocked' ? `🛡️ ${who}'s Shield blocked Bankrupt!`
      : spin.effect === 'lose_turn' ? `${who} lost a turn`
      : spin.effect === 'extra_turn' ? `🎁 ${who} got +200!`
      : spin.effect === 'double' ? `🔥 ${who} hit Double (×2)!`
      : spin.effect === 'jackpot' ? `💰 ${who} hit the Jackpot (+1000)!`
      : spin.effect === 'steal' ? `🦹 ${who} stole ${spin.stealAmount || 0}!`
      : spin.effect === 'shield' ? `🛡️ ${who} got a Shield!`
      : spin.effect === 'freeze' ? `❄️ ${who} froze ${spin.by === you ? oppName : 'your'} next turn!`
      : `${who} spun ${wedgeWord(spin.wedge)} — pick a consonant`
    if (spin.skipped) feedback += ' (frozen — go again!)'
  } else if (spin?.event === 'guess') {
    feedback = spin.correct ? `${who} found ${spin.count}× "${spin.letter}" (+${spin.points})`
      : `No "${spin.letter}" — turn passes${spin.skipped ? ' (opponent frozen!)' : ''}`
  } else if (spin?.event === 'vowel') {
    feedback = spin.correct ? `${who} bought "${spin.letter}" (×${spin.count})` : `No "${spin.letter}"`
  } else if (spin?.event === 'solve') {
    feedback = `${who} guessed wrong — turn passes${spin.skipped ? ' (opponent frozen!)' : ''}`
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

  const toWin = match.roundsToWin || Math.ceil(match.bestOf / 2)
  const dots = (count) => Array.from({ length: toWin }).map((_, i) => (
    <span key={i} className={`${m.roundDot} ${i < count ? m.roundDotWon : ''}`} />
  ))
  const status = (pid) => (
    <span className={m.status}>
      {match.shield?.[pid] && <span title="Shield — blocks next Bankrupt">🛡️</span>}
      {match.frozenId === pid && <span title="Frozen — turn will be skipped">❄️</span>}
    </span>
  )

  return (
    <div className={s.wrap}>
      {/* Scoreboard */}
      {isMulti ? (
        <div className={m.roster}>
          <div className={m.roundLabel}>Round {match.round} · first to {toWin}</div>
          <div ref={rosterRef} className={m.rosterList}>
            {everyone.map(p => (
              <div key={p.id} className={`${m.rosterItem} ${match.turnId === p.id ? m.sideActive : ''}`}>
                <span className={m.rosterName}>{p.id === you ? 'You' : p.name} {status(p.id)}</span>
                <span className={m.rosterBank}><CountUp end={match.bank?.[p.id] || 0} duration={0.4} preserveValue /></span>
                <span className={m.rounds}>{dots(match.roundWins?.[p.id] || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={m.scoreboard}>
          <div className={`${m.side} ${myTurn ? m.sideActive : ''}`}>
            <span className={m.sideName}>You {status(you)}</span>
            <span className={m.sideBank}><CountUp end={match.bank?.[you] || 0} duration={0.4} preserveValue /></span>
            <span className={m.rounds}>{dots(match.roundWins?.[you] || 0)}</span>
          </div>
          <div className={m.middle}>
            <span className={m.roundLabel}>Round {match.round}</span>
            <span className={m.vs}>VS</span>
          </div>
          <div className={`${m.side} ${!myTurn ? m.sideActive : ''}`}>
            <span className={m.sideName}>{oppName} {oppId && status(oppId)}</span>
            <span className={m.sideBank}><CountUp end={oppId ? (match.bank?.[oppId] || 0) : 0} duration={0.4} preserveValue /></span>
            <span className={m.rounds}>{dots(oppId ? (match.roundWins?.[oppId] || 0) : 0)}</span>
          </div>
        </div>
      )}

      <PuzzleBoard masked={match.masked} category={match.category} />

      <p key={`${feedback}-${spin?.ts || 0}`} className={`${s.feedback} ${myTurn ? m.yourTurn : ''}`} role="status">{feedback}</p>

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
