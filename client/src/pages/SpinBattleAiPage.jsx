import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useSound } from '../hooks/useSound.js'
import { recordGameForBadges } from '../services/badges.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import SpinBattle from '../components/match/SpinBattle.jsx'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import { SPIN_MS } from '../components/match/SpinWheel.jsx'
import styles from './SpinBattleAiPage.module.css'

const DIFFICULTIES = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
const OVER_DELAY = 1300

// Solo Spin Battle: spin the wheel, call consonants, buy vowels, solve the
// hidden phrase before you run out of strikes. Server owns the wheel + answer.
export default function SpinBattleAiPage() {
  const navigate = useNavigate()
  const { isRegistered, updateUser } = useAuth()
  const { totalGames } = usePlayer()
  const { playTone, playWin, playLose, unlock } = useSound()

  const [phase, setPhase]         = useState('SETUP')   // SETUP | PLAYING | DONE
  const [difficulty, setDifficulty] = useState('medium')
  const [game, setGame]           = useState(null)
  const [busy, setBusy]           = useState(false)
  const [spinning, setSpinning]   = useState(false)
  const [spinIndex, setSpinIndex] = useState(0)
  const [spinNonce, setSpinNonce] = useState(0)
  const [feedback, setFeedback]   = useState('')

  const sessionRef  = useRef(null)
  const pendingRef  = useRef(null)
  const recordedRef = useRef(false)

  async function startGame() {
    unlock()
    setBusy(true)
    try {
      const data = await api.post('/game/start', { mode: 'SPIN', difficulty, totalGames })
      sessionRef.current = data.sessionId
      recordedRef.current = false
      setGame(data)
      setFeedback('')
      setSpinNonce(0)
      setPhase('PLAYING')
    } catch { /* noop */ }
    finally { setBusy(false) }
  }

  function scheduleOver(data) {
    if (!data.over) return
    data.won ? playWin() : playLose()
    setTimeout(() => setPhase('DONE'), OVER_DELAY)
  }

  // Record once on game over (badges for everyone, stats for registered users).
  useEffect(() => {
    if (phase === 'DONE' && game && !recordedRef.current) {
      recordedRef.current = true
      const won = !!game.won
      recordGameForBadges({ mode: 'SPIN', won })
      if (isRegistered) {
        api.post('/game/record', { mode: 'SPIN', won })
          .then(d => { if (d.user) updateUser(d.user) })
          .catch(() => {})
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onSpin() {
    if (!game || game.canGuess || game.over || busy || spinning) return
    unlock()
    setBusy(true)
    setFeedback('')
    try {
      const data = await api.post('/game/spin/spin', { sessionId: sessionRef.current })
      pendingRef.current = data
      setSpinIndex(data.index)
      setSpinNonce(n => n + 1)
      setSpinning(true)
    } catch { setBusy(false) }
  }

  // Called by the wheel when its animation finishes — apply the server result.
  function onSettle() {
    const data = pendingRef.current
    setSpinning(false)
    setBusy(false)
    if (!data) return
    setGame(data)
    if (data.effect === 'points') { playTone(0.6); setFeedback(`Landed on ${data.wedge}! Call a consonant.`) }
    else if (data.effect === 'bankrupt')   { playTone(0.12); setFeedback('💀 Bankrupt — bank wiped!') }
    else if (data.effect === 'lose_turn')  { playTone(0.3);  setFeedback('Lose a turn — spin again.') }
    else if (data.effect === 'extra_turn') { playTone(0.8);  setFeedback('🎁 Bonus +200! Spin again.') }
    else if (data.effect === 'double')     { playTone(0.9);  setFeedback('🔥 Double! Bank ×2 — spin again.') }
    else if (data.effect === 'jackpot')    { playTone(0.95); setFeedback('💰 Jackpot! +1000 — spin again.') }
    else if (data.effect === 'steal')      { playTone(0.85); setFeedback('🦹 Steal! +400 — spin again.') }
    else if (data.effect === 'shield')     { playTone(0.8);  setFeedback('🛡️ Shield up! Blocks the next Bankrupt.') }
    else if (data.effect === 'bankrupt_blocked') { playTone(0.7); setFeedback('🛡️ Shield saved you from Bankrupt!') }
    else if (data.effect === 'freeze')     { playTone(0.75); setFeedback('❄️ +250 — nothing to freeze in solo.') }
  }

  async function onGuess(letter) {
    if (!game || !game.canGuess || game.over || busy || spinning) return
    unlock(); setBusy(true)
    try {
      const data = await api.post('/game/spin/guess', { sessionId: sessionRef.current, letter, totalGames })
      setGame(data)
      if (data.correct) { playTone(0.9); setFeedback(`Nice! +${data.points}`) }
      else { playTone(0.15); setFeedback(`No "${letter}" — strike ${data.strikes}/${data.maxStrikes}`) }
      scheduleOver(data)
    } catch { /* noop */ }
    finally { setBusy(false) }
  }

  async function onBuyVowel(letter) {
    if (!game || game.canGuess || game.over || busy || spinning) return
    unlock(); setBusy(true)
    try {
      const data = await api.post('/game/spin/vowel', { sessionId: sessionRef.current, letter, totalGames })
      setGame(data)
      if (data.correct) { playTone(0.85); setFeedback(`"${letter}" is in! (×${data.count})`) }
      else { playTone(0.2); setFeedback(`No "${letter}" — bank −${game.vowelCost}`) }
      scheduleOver(data)
    } catch { /* noop */ }
    finally { setBusy(false) }
  }

  async function onSolve(attempt) {
    if (!game || game.over || busy || spinning) return
    unlock(); setBusy(true)
    try {
      const data = await api.post('/game/spin/solve', { sessionId: sessionRef.current, attempt, totalGames })
      setGame(data)
      if (data.solved) { playTone(0.95); setFeedback('🎉 Solved it!') }
      else { playTone(0.15); setFeedback(`Not quite — strike ${data.strikes}/${data.maxStrikes}`) }
      scheduleOver(data)
    } catch { /* noop */ }
    finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <TutorialOverlay mode="SPIN" />
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <span className="badge badge-juice">🎡 Spin Battle</span>
          <span className={styles.vsTag}>🧠 Solo</span>
        </div>

        {phase === 'SETUP' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <SkullMascot expression="grudging" size={92} glow />
            <h1 className={styles.setupTitle}>Spin Battle</h1>
            <p className={styles.setupHint}>Spin the wheel, call consonants for points, buy vowels, and solve the hidden phrase — before five strikes end you.</p>

            <div className={styles.choiceLabel}>Difficulty</div>
            <div className={styles.diffRow}>
              {DIFFICULTIES.map(([id, label]) => (
                <button
                  key={id}
                  className={`${styles.diffBtn} ${difficulty === id ? styles.diffActive : ''}`}
                  onClick={() => setDifficulty(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.diffNote}>
              {difficulty === 'easy' ? 'Short phrases — gentle warm-up.'
                : difficulty === 'hard' ? 'Long phrases — real brain gym.'
                : 'Medium-length phrases.'}
            </p>

            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={startGame} disabled={busy}>
              ▶ Start
            </button>
          </div>
        )}

        {phase === 'PLAYING' && game && (
          <SpinBattle
            game={game}
            busy={busy}
            spinning={spinning}
            spinIndex={spinIndex}
            spinNonce={spinNonce}
            feedback={feedback}
            onSpin={onSpin}
            onGuess={onGuess}
            onBuyVowel={onBuyVowel}
            onSolve={onSolve}
            onSettle={onSettle}
          />
        )}

        {phase === 'DONE' && game && (
          <div className={`${styles.setup} anim-slide-up`}>
            <SkullMascot expression={game.won ? 'impressed' : 'annoyed'} size={92} glow={game.won} />
            <h1 className={styles.setupTitle}>{game.won ? 'Solved!' : 'Out of strikes'}</h1>
            <p className={styles.answerLine}>The answer was <b>{game.answer}</b></p>
            <div className={styles.scoreBig}>{game.bank} <span className={styles.scoreOf}>pts</span></div>
            {game.roast && <p className={styles.doneRoast}>&ldquo;{game.roast}&rdquo;</p>}
            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={startGame}>
              Play again
            </button>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/home')}>
              Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
