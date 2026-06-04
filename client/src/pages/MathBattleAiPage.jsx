import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
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
  const [question, setQuestion]     = useState(null)
  const [correct, setCorrect]       = useState(0)
  const [total, setTotal]           = useState(20)
  const [locked, setLocked]         = useState(false)
  const [reveal, setReveal]         = useState(null)
  const [myChoice, setMyChoice]     = useState(null)
  const [doneRoast, setDoneRoast]   = useState(null)
  const [busy, setBusy]             = useState(false)
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
    setBusy(true)
    try {
      const data = await api.post('/game/start', { mode: 'MATH', difficulty, totalGames })
      sessionRef.current = data.sessionId
      lockedRef.current = false
      correctRef.current = 0
      setCorrect(0)
      setTotal(data.total || 20)
      setLiveQuestion(data.question)
      setLocked(false); setReveal(null); setMyChoice(null); setDoneRoast(null)
      setPhase('PLAYING')
      startTimer()
    } catch { /* noop */ }
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
        const evt = c >= Math.ceil(total * 0.7) ? 'win' : c <= Math.floor(total * 0.35) ? 'lose' : 'draw'
        setDoneRoast(getModeRoast('MATH', evt))
        c >= Math.ceil(total * 0.7) ? playWin() : playLose()
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
            <SkullMascot expression="annoyed" size={92} glow />
            <h1 className={styles.setupTitle}>Solo Practice</h1>
            <p className={styles.setupHint}>20 questions, just you. Beat the clock on each one and keep your streak sharp. No AI, no mercy — only maths.</p>

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
              ▶ Start
            </button>
          </div>
        )}

        {phase === 'PLAYING' && (
          <MathBattle
            question={question}
            myScore={correct}
            oppName=""
            solo
            onAnswer={(choice) => answer(choice, false)}
            locked={locked}
            myChoice={myChoice}
            reveal={reveal}
            durationMs={QUESTION_MS}
          />
        )}

        {phase === 'DONE' && (
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
