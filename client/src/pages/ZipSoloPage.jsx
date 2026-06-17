import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import ZipBoard from '../components/match/ZipBoard.jsx'
import { generateZip, zipIsValidSolution, ZIP_SIZE } from '../utils/zip.js'
import { useSound } from '../hooks/useSound.js'
import { celebrateWin } from '../utils/celebrate.js'
import styles from './QueensSoloPage.module.css'   // shared solo-page styling

const DIFFS = [
  ['easy',   'Easy',   '🌱'],
  ['medium', 'Medium', '🔥'],
  ['hard',   'Hard',   '💀'],
]
const bestKey = (d) => `ns_zip_best_${d}`
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ZipSoloPage() {
  const navigate = useNavigate()
  const { playWin, unlock } = useSound()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | DONE
  const [difficulty, setDifficulty] = useState('medium')
  const [puzzle, setPuzzle]         = useState(null)      // { n, numbers, walls, solution }
  const [path, setPath]             = useState([])
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
    try { p = generateZip(diff) } catch { p = generateZip(diff) }
    setDifficulty(diff)
    setPuzzle(p)
    setPath([])
    setElapsed(0)
    setBest(Number(localStorage.getItem(bestKey(diff))) || null)
    startRef.current = Date.now()
    setPhase('PLAYING')
  }, [unlock])

  const onPath = useCallback((p) => {
    if (phase !== 'PLAYING') return
    setPath(p)
    if (zipIsValidSolution(p, puzzle.n, puzzle.numbers, puzzle.walls)) {
      const ms = Date.now() - startRef.current
      clearInterval(timerRef.current)
      setElapsed(ms)
      const prevBest = Number(localStorage.getItem(bestKey(difficulty))) || null
      if (prevBest == null || ms < prevBest) { localStorage.setItem(bestKey(difficulty), String(ms)); setBest(ms) }
      else setBest(prevBest)
      playWin?.()
      celebrateWin?.()
      setPhase('DONE')
    }
  }, [phase, puzzle, difficulty, playWin])

  const done = phase === 'DONE'

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'SETUP') {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <h1 className={styles.title}>🔢 Zip</h1>
          <p className={styles.sub}>Draw one path 1→last through every cell, never crossing a wall. Beat your best time.</p>
          <div className={styles.diffs}>
            {DIFFS.map(([id, label, icon]) => {
              const b = Number(localStorage.getItem(bestKey(id))) || null
              return (
                <button key={id} className={`card ${styles.diffCard}`} onClick={() => start(id)}>
                  <span className={styles.diffIcon}>{icon}</span>
                  <span className={styles.diffLabel}>{label}</span>
                  <span className={styles.diffMeta}>{ZIP_SIZE}×{ZIP_SIZE}</span>
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
  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPhase('SETUP')}>← Menu</button>
          <span className={styles.timer}>⏱ {fmtTime(elapsed)}</span>
          <span className={styles.progress}>🔢 {path.length}/{puzzle.n * puzzle.n}</span>
        </div>

        {done && (
          <div className={`${styles.resultBanner} anim-bounce-land`}>
            🏆 Solved in {fmtTime(elapsed)}{best === elapsed ? ' · New best!' : ''}
          </div>
        )}

        <ZipBoard
          n={puzzle.n}
          numbers={puzzle.numbers}
          walls={puzzle.walls}
          path={path}
          solved={done}
          disabled={done}
          onPath={onPath}
        />

        <div className={styles.controls}>
          {!done ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setPath([])}>Clear</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPath(p => p.slice(0, -1))} disabled={!path.length}>↩ Undo</button>
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
