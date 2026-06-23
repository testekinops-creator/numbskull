import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import TangoBoard from '../components/match/TangoBoard.jsx'
import { generateTango, tangoIsValidSolution, TANGO_SIZE } from '../utils/tango.js'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { celebrateWin } from '../utils/celebrate.js'
import GameIcon from '../components/icons/GameIcon.jsx'
import { SproutIcon, FlameIcon, SkullIcon, ClockIcon, TrophyIcon, BulbIcon } from '../components/icons/Icons.jsx'
import { DIFFICULTY } from '../components/icons/difficulty.js'
import styles from './QueensSoloPage.module.css'   // shared solo-page styling

const DIFFS = [
  ['easy',   'Easy',   SproutIcon],
  ['medium', 'Medium', FlameIcon],
  ['hard',   'Hard',   SkullIcon],
]
const MAX_HINTS = 2
const bestKey = (d) => `ns_tango_best_${d}`
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const startFromGivens = (p) => p.givens.map(g => g || 'empty')

export default function TangoSoloPage() {
  const navigate = useNavigate()
  const { playTone, playWin, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | DONE
  const [difficulty, setDifficulty] = useState('medium')
  const [puzzle, setPuzzle]         = useState(null)      // { n, givens, constraints, solution }
  const [board, setBoard]           = useState([])
  const [hintsLeft, setHintsLeft]   = useState(MAX_HINTS)
  const [elapsed, setElapsed]       = useState(0)
  const [best, setBest]             = useState(null)
  const startRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (phase !== 'PLAYING') return
    timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250)
    return () => clearInterval(timerRef.current)
  }, [phase])

  const start = useCallback((diff) => {
    unlock()
    let p
    try { p = generateTango(diff) } catch { p = generateTango(diff) }
    setDifficulty(diff)
    setPuzzle(p)
    setBoard(startFromGivens(p))
    setHintsLeft(MAX_HINTS)
    setElapsed(0)
    setBest(Number(localStorage.getItem(bestKey(diff))) || null)
    startRef.current = Date.now()
    setPhase('PLAYING')
  }, [unlock])

  const onPlace = useCallback((index, next) => {
    if (phase !== 'PLAYING') return
    if (puzzle.givens[index]) return   // locked given
    buzz?.()
    setBoard(prev => {
      const b = [...prev]
      b[index] = next
      if (tangoIsValidSolution(b, puzzle.n, puzzle.constraints)) {
        const ms = Date.now() - startRef.current
        clearInterval(timerRef.current)
        setElapsed(ms)
        const prevBest = Number(localStorage.getItem(bestKey(difficulty))) || null
        if (prevBest == null || ms < prevBest) { localStorage.setItem(bestKey(difficulty), String(ms)); setBest(ms) }
        else setBest(prevBest)
        playWin?.()
        celebrateWin?.()
        setPhase('DONE')
      } else {
        playTone?.()
      }
      return b
    })
  }, [phase, puzzle, difficulty, buzz, playWin, playTone])

  const clearBoard = () => puzzle && setBoard(startFromGivens(puzzle))

  // Reveal one correct, not-yet-correct cell.
  const useHint = () => {
    if (hintsLeft <= 0 || !puzzle) return
    const wrong = []
    for (let i = 0; i < puzzle.solution.length; i++) {
      if (puzzle.givens[i]) continue
      if (board[i] !== puzzle.solution[i]) wrong.push(i)
    }
    if (!wrong.length) return
    const idx = wrong[Math.floor(Math.random() * wrong.length)]
    setHintsLeft(h => h - 1)
    onPlace(idx, puzzle.solution[idx])
  }

  const filled = board.filter(c => c !== 'empty').length

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'SETUP') {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <h1 className={styles.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><GameIcon icon="tango" size={26} /> Tango</h1>
          <p className={styles.sub}>Fill ☀️/🌙 — 3 each per row &amp; column, no 3 in a row, obey =/×. Beat your best time.</p>
          <div className={styles.diffs}>
            {DIFFS.map(([id, label, Icon]) => {
              const b = Number(localStorage.getItem(bestKey(id))) || null
              return (
                <button key={id} className={`card ${styles.diffCard}`} onClick={() => start(id)} style={{ borderLeft: `4px solid ${DIFFICULTY[id].color}` }}>
                  <span className={styles.diffIcon}><Icon size={22} style={{ color: DIFFICULTY[id].color }} /></span>
                  <span className={styles.diffLabel}>{label}</span>
                  <span className={styles.diffMeta}>{TANGO_SIZE}×{TANGO_SIZE}</span>
                  <span className={styles.diffBest}>{b ? `Best ${fmtTime(b)}` : '—'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── PLAYING / DONE ───────────────────────────────────────────────────────────
  const done = phase === 'DONE'
  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPhase('SETUP')}>← Menu</button>
          <span className={styles.timer} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><ClockIcon size={15} /> {fmtTime(elapsed)}</span>
          <span className={styles.progress} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><GameIcon icon="tango" size={15} /> {filled}/{puzzle.n * puzzle.n}</span>
        </div>

        {done && (
          <div className={`${styles.resultBanner} anim-bounce-land`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <TrophyIcon size={18} /> Solved in {fmtTime(elapsed)}{best === elapsed ? ' · New best!' : ''}
          </div>
        )}

        <TangoBoard
          n={puzzle.n}
          givens={puzzle.givens}
          constraints={puzzle.constraints}
          board={board}
          solved={done}
          disabled={done}
          onPlace={onPlace}
        />

        <div className={styles.controls}>
          {!done ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={clearBoard}>Clear</button>
              <button className="btn btn-ghost btn-sm" onClick={useHint} disabled={hintsLeft <= 0}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BulbIcon size={14} /> Hint ({hintsLeft})</span></button>
            </>
          ) : (
            <>
              <button className="btn btn-juice" onClick={() => start(difficulty)}>Play again</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>Home</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
