import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameLogo from '../components/GameLogo.jsx'
import Loader from '../components/Loader.jsx'
import MathBattle from '../components/match/MathBattle.jsx'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { getModeRoast } from '../utils/roasts.js'
import styles from './MathBattleAiPage.module.css'

const DIFFICULTIES = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
const QUESTION_MS = 12000   // per-question timer (solo practice pressure)
const REVEAL_MS = 1300

// Solo practice: 20 questions, no AI opponent — answer at speed, sharpen up.
export default function MathBattleAiPage() {
  const navigate = useNavigate()
  const { totalGames } = usePlayer()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | DONE
  const [difficulty, setDifficulty] = useState('medium')
  const [gameMode, setGameMode]     = useState('standard') // standard (20 Q) | endless (survival)
  const [best, setBest]             = useState(() => Number(localStorage.getItem('ns_math_endless_best') || 0))
  const [question, setQuestion]     = useState(null)
  const [correct, setCorrect]       = useState(0)
  const [total, setTotal]           = useState(20)
  const [locked, setLocked]         = useState(false)
  const [reveal, setReveal]         = useState(null)
  const [myChoice, setMyChoice]     = useState(null)
  const [doneRoast, setDoneRoast]   = useState(null)
  const [busy, setBusy]             = useState(false)
  const [startErr, setStartErr]     = useState('')
  const [tutorialDone, setTutorialDone] = useState(false)

  const sessionRef  = useRef(null)
  const questionRef = useRef(null)
  const timerRef    = useRef(null)
  const lockedRef   = useRef(false)
  const correctRef  = useRef(0)

  function setLiveQuestion(q) { questionRef.current = q; setQuestion(q) }
  function clearTimer() { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  function startTimer() { clearTimer(); timerRef.current = setTimeout(() => answer(null, true), QUESTION_MS) }

  useEffect(() => () => clearTimer(), [])

  async function startGame() {
    unlock()
    setStartErr('')
    setBusy(true)
    try {
      const endless = gameMode === 'endless'
      const data = await api.post('/game/start', { mode: 'MATH', difficulty, totalGames, endless })
      sessionRef.current = data.sessionId
      lockedRef.current = false
      correctRef.current = 0
      setCorrect(0)
      setTotal(endless ? Infinity : (data.total || 20))
      setLiveQuestion(data.question)
      setLocked(false); setReveal(null); setMyChoice(null); setDoneRoast(null)
      setPhase('PLAYING')
      startTimer()
    } catch (e) { setStartErr(e?.message || 'Could not start — please try again') }
    finally { setBusy(false) }
  }

  async function answer(choice, isTimeout = false) {
    const q = questionRef.current
    if (lockedRef.current || !q) return
    lockedRef.current = true
    setLocked(true)
    clearTimer()
    if (!isTimeout) { unlock(); setMyChoice(choice) }

    try {
      const data = await api.post('/game/math/answer', {
        sessionId: sessionRef.current,
        index: q.index,
        by: 'player',
        choice,
        totalGames,
      })
      if (data.stale) { lockedRef.current = false; setLocked(false); return }

      if (data.correct) { correctRef.current += 1; setCorrect(correctRef.current); playTone(0.95); buzz('correct') }
      else { playTone(0.15); buzz(isTimeout ? 'wrong' : 'error') }

      setReveal({ answer: data.answer, byMe: true, correct: data.correct, timeout: isTimeout })

      if (data.over) {
        const c = correctRef.current
        if (data.endless) {
          // Survival run ended on the first miss — score is the streak so far.
          const isBest = c > best
          if (isBest) { setBest(c); localStorage.setItem('ns_math_endless_best', String(c)) }
          setDoneRoast(data.roast || getModeRoast('MATH', isBest ? 'win' : 'lose'))
          isBest && c > 0 ? playWin() : playLose()
        } else {
          const evt = c >= Math.ceil(total * 0.7) ? 'win' : c <= Math.floor(total * 0.35) ? 'lose' : 'draw'
          setDoneRoast(getModeRoast('MATH', evt))
          c >= Math.ceil(total * 0.7) ? playWin() : playLose()
        }
        setTimeout(() => setPhase('DONE'), REVEAL_MS)
      } else {
        setTimeout(() => {
          lockedRef.current = false
          setLocked(false); setReveal(null); setMyChoice(null)
          setLiveQuestion(data.next)
          startTimer()
        }, REVEAL_MS)
      }
    } catch {
      lockedRef.current = false
      setLocked(false)
    }
  }

  return (
    <div className="screen">
      {!tutorialDone && <TutorialOverlay mode="MATH" onDone={() => setTutorialDone(true)} />}
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <span className="badge badge-juice">🧮 Math Battle</span>
          <span className={styles.vsTag}>🧠 Solo</span>
        </div>

        {phase === 'SETUP' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <GameLogo variant="static" size={92} />
            <h1 className={styles.setupTitle}>Solo Practice</h1>
            <p className={styles.setupHint}>
              {gameMode === 'endless'
                ? 'Survival: one wrong answer ends the run. How long can your streak last? No AI, no mercy — only maths.'
                : '20 questions, just you. Beat the clock on each one and keep your streak sharp. No AI, no mercy — only maths.'}
            </p>

            <div className={styles.choiceLabel}>Mode</div>
            <div className={styles.diffRow}>
              <button
                className={`${styles.diffBtn} ${gameMode === 'standard' ? styles.diffActive : ''}`}
                onClick={() => setGameMode('standard')}
              >
                🎯 Standard
              </button>
              <button
                className={`${styles.diffBtn} ${gameMode === 'endless' ? styles.diffActive : ''}`}
                onClick={() => setGameMode('endless')}
              >
                ♾️ Endless
              </button>
            </div>
            {gameMode === 'endless' && best > 0 && (
              <p className={styles.diffNote}>Best streak: <b style={{ color: 'var(--color-juice)' }}>{best}</b></p>
            )}

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
              {difficulty === 'easy' ? 'Smaller numbers, gentle warm-up.'
                : difficulty === 'hard' ? 'Big numbers, tight clock. Brain gym.'
                : 'A balanced workout.'}
            </p>

            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={startGame} disabled={busy}>
              {busy ? <><Loader inline size={16} />Starting…</> : '▶ Start'}
            </button>
            {startErr && <p style={{ color: 'var(--color-pink)', textAlign: 'center', marginTop: 'var(--space-2, 8px)' }}>{startErr}</p>}
          </div>
        )}

        {phase === 'PLAYING' && (
          <MathBattle
            question={question}
            myScore={correct}
            oppName=""
            solo
            endless={gameMode === 'endless'}
            onAnswer={(choice) => answer(choice, false)}
            locked={locked}
            myChoice={myChoice}
            reveal={reveal}
            durationMs={QUESTION_MS}
          />
        )}

        {phase === 'DONE' && gameMode === 'endless' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <SkullMascot expression={correct >= best && correct > 0 ? 'impressed' : 'annoyed'} size={92} glow={correct >= best && correct > 0} />
            <h1 className={styles.setupTitle}>{correct >= best && correct > 0 ? '🏆 New best streak!' : 'Run over'}</h1>
            <div className={styles.scoreBig}>{correct}</div>
            <p className={styles.setupHint}>in a row · best {best}</p>
            {doneRoast && <p className={styles.doneRoast}>&ldquo;{doneRoast}&rdquo;</p>}
            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={() => setPhase('SETUP')}>
              Try again
            </button>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/home')}>
              Home
            </button>
          </div>
        )}

        {phase === 'DONE' && gameMode !== 'endless' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <SkullMascot expression={correct >= Math.ceil(total * 0.7) ? 'impressed' : 'annoyed'} size={92} glow={correct >= Math.ceil(total * 0.7)} />
            <h1 className={styles.setupTitle}>Practice complete</h1>
            <div className={styles.scoreBig}>{correct} <span className={styles.scoreOf}>/ {total}</span></div>
            <p className={styles.setupHint}>correct</p>
            {doneRoast && <p className={styles.doneRoast}>&ldquo;{doneRoast}&rdquo;</p>}
            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={() => setPhase('SETUP')}>
              Practice again
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
