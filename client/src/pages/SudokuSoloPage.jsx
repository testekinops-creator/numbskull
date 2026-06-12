import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { recordGameForBadges } from '../services/badges.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import GameLogo from '../components/GameLogo.jsx'
import RoomActionDock from '../components/game/RoomActionDock.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import SudokuGrid from '../components/match/SudokuGrid.jsx'
import SudokuNumberPad from '../components/match/SudokuNumberPad.jsx'
import { generate, peersOf } from '../utils/sudoku.js'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { celebrateWin, celebrateChit } from '../utils/celebrate.js'
import styles from './SudokuSoloPage.module.css'

const DIFFS = [
  ['easy',   'Easy',   '🌱'],
  ['medium', 'Medium', '🔥'],
  ['hard',   'Hard',   '💀'],
]
const MAX_LIVES = 3
const MAX_HINTS = 3
const WRONG_FLASH_MS = 380

const SOLO_ROAST = {
  win:  ['Solved. The grid never stood a chance.', 'Clean run. I almost respect you.', 'Every cell in its place. Show-off.'],
  lose: ['Three strikes. The grid wins this round.', 'Out of lives — the numbers got the better of you.', 'So close, yet so very empty.'],
}
const pick = (a) => a[Math.floor(Math.random() * a.length)]

const bestKey = (d) => `ns_sudoku_best_${d}`
const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function SudokuSoloPage() {
  const navigate = useNavigate()
  const { isRegistered, updateUser } = useAuth()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | GAME_OVER
  const [difficulty, setDifficulty] = useState('medium')

  const [given, setGiven]     = useState([])
  const [grid, setGrid]       = useState([])
  const [status, setStatus]   = useState([])
  const [notes, setNotes]     = useState({})
  const [selected, setSelected] = useState(null)
  const [notesMode, setNotesMode] = useState(false)

  const [lives, setLives]       = useState(MAX_LIVES)
  const [hintsLeft, setHints]   = useState(MAX_HINTS)
  const [mistakes, setMistakes] = useState(0)
  const [hintCell, setHintCell] = useState(null)

  const [elapsed, setElapsed] = useState(0)
  const [won, setWon]         = useState(false)
  const [roast, setRoast]     = useState(null)
  const [newBest, setNewBest] = useState(false)

  const solutionRef = useRef([])
  const blanksRef   = useRef(0)
  const startRef    = useRef(0)
  const undoRef     = useRef([])
  const recordedRef = useRef(false)
  const loseFiredRef = useRef(false)
  const boardRef    = useRef(null)

  // ── Start / restart ───────────────────────────────────────────────────────
  function startGame(diff = difficulty) {
    unlock()
    const { puzzle, solution, givens } = generate(diff)
    solutionRef.current = solution
    blanksRef.current   = givens.filter(g => !g).length
    undoRef.current     = []
    setDifficulty(diff)
    setGiven(givens)
    setGrid([...puzzle])
    setStatus(puzzle.map(v => (v !== 0 ? 'given' : 'empty')))
    setNotes({})
    setSelected(null)
    setNotesMode(false)
    setLives(MAX_LIVES)
    setHints(MAX_HINTS)
    setMistakes(0)
    setHintCell(null)
    setElapsed(0)
    setWon(false)
    setRoast(null)
    setNewBest(false)
    recordedRef.current = false
    startRef.current = Date.now()
    setPhase('PLAYING')
  }

  // ── Live timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'PLAYING') return
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 250)
    return () => clearInterval(id)
  }, [phase])

  // Out of lives → game over (after the final wrong-cell shake). Effect-driven so
  // rapid taps can't race the life count; the ref stops it firing twice.
  useEffect(() => {
    if (phase !== 'PLAYING') { loseFiredRef.current = false; return }
    if (lives <= 0 && !loseFiredRef.current) {
      loseFiredRef.current = true
      const t = setTimeout(endLose, WRONG_FLASH_MS)
      return () => clearTimeout(t)
    }
  }, [lives, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectable = useCallback((i) => !given[i] && status[i] !== 'correct', [given, status])

  // Remaining-per-digit for the smart pad (9 minus those locked in correctly).
  const remaining = (() => {
    const r = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 }
    for (let i = 0; i < 81; i++) {
      if ((given[i] || status[i] === 'correct') && grid[i]) r[grid[i]]--
    }
    return r
  })()

  function endWin() {
    const ms = Date.now() - startRef.current
    setElapsed(ms)
    const prev = Number(localStorage.getItem(bestKey(difficulty))) || 0
    const isBest = prev === 0 || ms < prev
    if (isBest) localStorage.setItem(bestKey(difficulty), String(ms))
    setNewBest(isBest)
    setWon(true)
    setRoast(pick(SOLO_ROAST.win))
    playWin(); buzz('correct'); celebrateWin()
    setPhase('GAME_OVER')
  }

  function endLose() {
    setElapsed(Date.now() - startRef.current)
    setWon(false)
    setRoast(pick(SOLO_ROAST.lose))
    playLose(); buzz('wrong')
    setPhase('GAME_OVER')
  }

  // ── Number entry ──────────────────────────────────────────────────────────
  function placeNumber(n) {
    if (phase !== 'PLAYING' || selected == null || lives <= 0) return
    const cell = selected
    if (given[cell] || status[cell] === 'correct') return

    // Notes mode → toggle a pencil candidate on an empty cell.
    if (notesMode) {
      if (grid[cell]) return
      undoRef.current.push({ type: 'note', index: cell, prevNotes: notes[cell] ? [...notes[cell]] : null })
      setNotes(prev => {
        const cur = new Set(prev[cell] || [])
        cur.has(n) ? cur.delete(n) : cur.add(n)
        return { ...prev, [cell]: [...cur].sort((a, b) => a - b) }
      })
      buzz('tap')
      return
    }

    const correct = solutionRef.current[cell] === n
    if (correct) {
      undoRef.current.push({ type: 'fill', index: cell, prevNotes: notes[cell] ? [...notes[cell]] : null })
      setGrid(g => { const c = [...g]; c[cell] = n; return c })
      setStatus(s => { const c = [...s]; c[cell] = 'correct'; return c })
      // Clear this cell's notes and strip n from its peers' notes (QoL).
      setNotes(prev => {
        const next = { ...prev }; delete next[cell]
        for (const p of peersOf(cell)) {
          if (next[p]?.includes(n)) next[p] = next[p].filter(x => x !== n)
        }
        return next
      })
      playTone(0.5); buzz('correct')
      const el = boardRef.current?.querySelector('[role="grid"]')?.children[cell]
      if (el) {
        const r = el.getBoundingClientRect()
        celebrateChit({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight })
      }
      // Win when every blank is correct.
      let solvedCount = 0
      for (let i = 0; i < 81; i++) if (!given[i] && (i === cell || status[i] === 'correct')) solvedCount++
      if (solvedCount >= blanksRef.current) { setTimeout(endWin, 240); return }
    } else {
      // Wrong → flash red, lose a life, then revert the cell (mobile-app feel).
      // Game-over is handled by the lives effect, so this stays race-safe.
      setMistakes(m => m + 1)
      setGrid(g => { const c = [...g]; c[cell] = n; return c })
      setStatus(s => { const c = [...s]; c[cell] = 'wrong'; return c })
      playLose(); buzz('wrong')
      setLives(l => Math.max(0, l - 1))
      setTimeout(() => {
        setGrid(g => { if (g[cell] !== n) return g; const c = [...g]; c[cell] = 0; return c })
        setStatus(s => { if (s[cell] !== 'wrong') return s; const c = [...s]; c[cell] = 'empty'; return c })
      }, WRONG_FLASH_MS)
    }
  }

  function useHint() {
    if (phase !== 'PLAYING' || hintsLeft <= 0) return
    // Prefer the selected empty cell, else a random unsolved blank.
    let cell = (selected != null && !given[selected] && status[selected] !== 'correct') ? selected : null
    if (cell == null) {
      const blanks = []
      for (let i = 0; i < 81; i++) if (!given[i] && status[i] !== 'correct') blanks.push(i)
      if (!blanks.length) return
      cell = blanks[Math.floor(Math.random() * blanks.length)]
    }
    const val = solutionRef.current[cell]
    setGrid(g => { const c = [...g]; c[cell] = val; return c })
    setStatus(s => { const c = [...s]; c[cell] = 'correct'; return c })
    setNotes(prev => { const next = { ...prev }; delete next[cell]; return next })
    setHints(h => h - 1)
    setHintCell(cell)
    setTimeout(() => setHintCell(null), 2000)
    playTone(0.7); buzz('tap')
    let solvedCount = 0
    for (let i = 0; i < 81; i++) if (!given[i] && (i === cell || status[i] === 'correct')) solvedCount++
    if (solvedCount >= blanksRef.current) setTimeout(endWin, 240)
  }

  function doUndo() {
    const act = undoRef.current.pop()
    if (!act) return
    buzz('tap')
    if (act.type === 'note') {
      setNotes(prev => ({ ...prev, [act.index]: act.prevNotes || [] }))
    } else { // 'fill' → empty the cell, restore any prior notes
      setGrid(g => { const c = [...g]; c[act.index] = 0; return c })
      setStatus(s => { const c = [...s]; c[act.index] = 'empty'; return c })
      setNotes(prev => {
        const next = { ...prev }
        if (act.prevNotes) next[act.index] = act.prevNotes; else delete next[act.index]
        return next
      })
    }
  }

  // Desktop keyboard: 1–9 enter, Backspace undo, N toggles notes.
  useEffect(() => {
    if (phase !== 'PLAYING') return
    const onKey = (e) => {
      if (e.key >= '1' && e.key <= '9') placeNumber(Number(e.key))
      else if (e.key === 'Backspace' || e.key === 'Delete') doUndo()
      else if (e.key.toLowerCase() === 'n') setNotesMode(m => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // re-bind each render so handlers see fresh state

  // Record stats / badges once on game over.
  useEffect(() => {
    if (phase === 'GAME_OVER' && !recordedRef.current) {
      recordedRef.current = true
      recordGameForBadges({ mode: 'SUDOKU', won })
      if (isRegistered) {
        api.post('/game/record', { mode: 'SUDOKU', won }).then(d => { if (d.user) updateUser(d.user) }).catch(() => {})
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const solved = blanksRef.current
    ? status.filter((s, i) => !given[i] && s === 'correct').length
    : 0

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`} style={{ paddingBottom: 88 }}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <span className="badge badge-juice">🔢 Sudoku</span>
          <span className={styles.soloTag}>Solo</span>
        </div>

        {phase === 'SETUP' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <GameLogo variant="static" size={88} />
            <h1 className={styles.setupTitle}>Sudoku</h1>
            <p className={styles.setupHint}>Fill the grid so every row, column and 3×3 box has 1–9. Three mistakes and it's over.</p>

            <div className={styles.choiceLabel}>Difficulty</div>
            <div className={styles.diffRow}>
              {DIFFS.map(([id, label, emoji]) => {
                const b = Number(localStorage.getItem(bestKey(id))) || 0
                return (
                  <button
                    key={id}
                    className={`${styles.diffCard} ${difficulty === id ? styles.diffActive : ''}`}
                    onClick={() => setDifficulty(id)}
                  >
                    <span className={styles.diffEmoji}>{emoji}</span>
                    <span className={styles.diffName}>{label}</span>
                    <span className={styles.diffBest}>{b ? `★ ${fmtTime(b)}` : '—'}</span>
                  </button>
                )
              })}
            </div>

            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={() => startGame(difficulty)}>
              ▶ Start
            </button>
          </div>
        )}

        {phase === 'PLAYING' && (
          <div className={styles.play}>
            <div className={styles.hud}>
              <span className={styles.lives} aria-label={`${lives} lives left`}>
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <span key={i} className={i < lives ? styles.heart : styles.heartLost}>{i < lives ? '❤️' : '🤍'}</span>
                ))}
              </span>
              <span className={styles.timer}>⏱️ {fmtTime(elapsed)}</span>
              <span className={styles.progress}>{solved}/{blanksRef.current}</span>
            </div>

            <div className={styles.boardWrap} ref={boardRef}>
              <SudokuGrid
                grid={grid}
                given={given}
                status={status}
                selected={selected}
                onSelect={(i) => { if (selectable(i)) setSelected(i) }}
                selectable={selectable}
                notes={notes}
                hintCell={hintCell}
              />
            </div>

            <SudokuNumberPad
              onNumber={placeNumber}
              selected={selected != null}
              remaining={remaining}
              notesMode={notesMode}
              onToggleNotes={() => setNotesMode(m => !m)}
              onUndo={doUndo}
              undoEnabled={undoRef.current.length > 0}
              onHint={useHint}
              hintsLeft={hintsLeft}
            />
          </div>
        )}

        {phase === 'GAME_OVER' && (
          <GameOverCard
            won={won}
            mode="SUDOKU"
            roast={roast}
            stats={won
              ? [
                  { label: 'Time', value: fmtTime(elapsed), highlight: newBest },
                  { label: 'Mistakes', value: mistakes },
                  { label: 'Best', value: fmtTime(Number(localStorage.getItem(bestKey(difficulty))) || elapsed), accent: true },
                ]
              : [
                  { label: 'Time', value: fmtTime(elapsed) },
                  { label: 'Filled', value: `${solved}/${blanksRef.current}` },
                ]}
            onPlayAgain={() => setPhase('SETUP')}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
      <RoomActionDock mode="SUDOKU" hasOpponent={false} showCall={false} tuckedAway={phase === 'GAME_OVER'} />
      <TutorialOverlay mode="SUDOKU" />
    </div>
  )
}
