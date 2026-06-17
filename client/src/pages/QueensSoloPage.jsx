import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import QueensBoard from '../components/match/QueensBoard.jsx'
import { generateQueens, isValidSolution, QUEENS_SIZE } from '../utils/queens.js'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { celebrateWin } from '../utils/celebrate.js'
import styles from './QueensSoloPage.module.css'

const DIFFS = [
  ['easy',   'Easy',   '🌱'],
  ['medium', 'Medium', '🔥'],
  ['hard',   'Hard',   '💀'],
]
const MAX_HINTS = 2
const bestKey = (d) => `ns_queens_best_${d}`
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const NEXT = { empty: 'queen', queen: 'x', x: 'empty' }

export default function QueensSoloPage() {
  const navigate = useNavigate()
  const { playTone, playWin, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | DONE
  const [difficulty, setDifficulty] = useState('medium')
  const [puzzle, setPuzzle]         = useState(null)      // { n, regions, solution }
  const [board, setBoard]           = useState([])
  const [hintsLeft, setHintsLeft]   = useState(MAX_HINTS)
  const [elapsed, setElapsed]       = useState(0)
  const [best, setBest]             = useState(null)
  const startRef = useRef(0)
  const timerRef = useRef(null)

  // Tick while playing.
  useEffect(() => {
    if (phase !== 'PLAYING') return
    timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250)
    return () => clearInterval(timerRef.current)
  }, [phase])

  const start = useCallback((diff) => {
    unlock()
    let p
    try { p = generateQueens(diff) } catch { p = generateQueens(diff) }   // retry once on the rare miss
    setDifficulty(diff)
    setPuzzle(p)
    setBoard(Array(p.n * p.n).fill('empty'))
    setHintsLeft(MAX_HINTS)
    setElapsed(0)
    setBest(Number(localStorage.getItem(bestKey(diff))) || null)
    startRef.current = Date.now()
    setPhase('PLAYING')
  }, [unlock])

  const onPlace = useCallback((index, next) => {
    if (phase !== 'PLAYING') return
    buzz?.()
    setBoard(prev => {
      const b = [...prev]
      b[index] = next
      if (isValidSolution(b, puzzle.regions, puzzle.n)) {
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

  const clearBoard = () => puzzle && setBoard(Array(puzzle.n * puzzle.n).fill('empty'))

  // Reveal one correct queen the player hasn't placed yet.
  const useHint = () => {
    if (hintsLeft <= 0 || !puzzle) return
    const missing = []
    for (let i = 0; i < puzzle.solution.length; i++) if (puzzle.solution[i] && board[i] !== 'queen') missing.push(i)
    if (!missing.length) return
    const idx = missing[Math.floor(Math.random() * missing.length)]
    setHintsLeft(h => h - 1)
    onPlace(idx, 'queen')
  }

  const queensPlaced = board.filter(c => c === 'queen').length

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'SETUP') {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <h1 className={styles.title}>👑 Queens</h1>
          <p className={styles.sub}>One queen per row, column & color region — none touching. Beat your best time.</p>
          <div className={styles.diffs}>
            {DIFFS.map(([id, label, icon]) => {
              const b = Number(localStorage.getItem(bestKey(id))) || null
              return (
                <button key={id} className={`card ${styles.diffCard}`} onClick={() => start(id)}>
                  <span className={styles.diffIcon}>{icon}</span>
                  <span className={styles.diffLabel}>{label}</span>
                  <span className={styles.diffMeta}>{QUEENS_SIZE[id]}×{QUEENS_SIZE[id]}</span>
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
          <span className={styles.timer}>⏱ {fmtTime(elapsed)}</span>
          <span className={styles.progress}>👑 {queensPlaced}/{puzzle.n}</span>
        </div>

        {done && (
          <div className={`${styles.resultBanner} anim-bounce-land`}>
            🏆 Solved in {fmtTime(elapsed)}{best === elapsed ? ' · New best!' : ''}
          </div>
        )}

        <QueensBoard
          n={puzzle.n}
          regions={puzzle.regions}
          board={board}
          solved={done}
          disabled={done}
          onPlace={onPlace}
        />

        <div className={styles.controls}>
          {!done ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={clearBoard}>Clear</button>
              <button className="btn btn-ghost btn-sm" onClick={useHint} disabled={hintsLeft <= 0}>💡 Hint ({hintsLeft})</button>
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
