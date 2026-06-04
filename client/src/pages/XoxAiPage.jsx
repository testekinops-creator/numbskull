import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import XoxBoard from '../components/match/XoxBoard.jsx'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import styles from './XoxAiPage.module.css'

const DIFFICULTIES = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]

export default function XoxAiPage() {
  const navigate = useNavigate()
  const { isRegistered, updateUser, user } = useAuth()
  const { totalGames } = usePlayer()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | GAME_OVER
  const [symbol, setSymbol]         = useState('X')
  const [difficulty, setDifficulty] = useState('medium')
  const [board, setBoard]           = useState(Array(9).fill(null))
  const [turn, setTurn]             = useState('X')
  const [lastCell, setLastCell]     = useState(null)
  const [over, setOver]             = useState(false)
  const [won, setWon]               = useState(false)
  const [draw, setDraw]             = useState(false)
  const [roast, setRoast]           = useState(null)
  const [busy, setBusy]             = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)

  const sessionRef  = useRef(null)
  const recordedRef = useRef(false)
  const games = user?.totalGames ?? totalGames

  async function startGame() {
    unlock()
    setBusy(true)
    try {
      const data = await api.post('/game/start', { mode: 'XOX', difficulty, symbol, totalGames: games })
      sessionRef.current = data.sessionId
      setBoard(data.board)
      setTurn(data.turn)
      setLastCell(null)
      setOver(false); setWon(false); setDraw(false); setRoast(null)
      recordedRef.current = false
      setPhase('PLAYING')
    } catch { /* surfaced via inline state if needed */ }
    finally { setBusy(false) }
  }

  async function handleCell(i) {
    if (over || busy || turn !== symbol || board[i] !== null) return
    unlock()
    setBusy(true)
    try {
      const data = await api.post('/game/xox/move', { cell: i, sessionId: sessionRef.current, totalGames: games })
      if (!data.valid) { buzz('error'); return }
      setBoard(data.board)
      setTurn(data.turn)
      setLastCell(data.aiMove != null ? data.aiMove : i)
      if (data.roast) setRoast(data.roast)

      if (data.over) {
        setOver(true)
        if (data.draw) { setDraw(true); playLose(); buzz('wrong') }
        else if (data.winner === data.playerSymbol) { setWon(true); playWin(); buzz('correct') }
        else { playLose(); buzz('wrong') }
        setPhase('GAME_OVER')
      } else {
        playTone(0.5)
      }
    } catch { buzz('error') }
    finally { setBusy(false) }
  }

  // Record the finished game to a logged-in user's account (once).
  useEffect(() => {
    if (phase === 'GAME_OVER' && isRegistered && !recordedRef.current) {
      recordedRef.current = true
      api.post('/game/record', { mode: 'XOX', won: won && !draw })
        .then(d => { if (d.user) updateUser(d.user) })
        .catch(() => {})
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const myTurn = phase === 'PLAYING' && turn === symbol && !over

  return (
    <div className="screen">
      {!tutorialDone && <TutorialOverlay mode="XOX" onDone={() => setTutorialDone(true)} />}
      <div className={`panel ${styles.page}`}>
        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <span className="badge badge-juice">⭕ Tic-Tac-Toe</span>
          <span className={styles.vsTag}>vs 🤖</span>
        </div>

        {/* SETUP */}
        {phase === 'SETUP' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <SkullMascot expression="grudging" size={92} glow />
            <h1 className={styles.setupTitle}>Tic-Tac-Toe</h1>
            <p className={styles.setupHint}>Pick your mark and how badly you want to lose.</p>

            <div className={styles.choiceLabel}>Your mark</div>
            <div className={styles.symbolRow}>
              {['X', 'O'].map(s => (
                <button
                  key={s}
                  className={`${styles.symbolBtn} ${symbol === s ? styles.symbolActive : ''} ${s === 'X' ? styles.symX : styles.symO}`}
                  onClick={() => setSymbol(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className={styles.symbolNote}>{symbol === 'X' ? 'X moves first.' : 'O moves second — I open.'}</p>

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
            {difficulty === 'hard' && (
              <p className={styles.hardWarn}>⚠️ Hard is unbeatable. Best you'll get is a draw.</p>
            )}

            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={startGame} disabled={busy}>
              ▶ Start
            </button>
          </div>
        )}

        {/* PLAYING */}
        {phase === 'PLAYING' && (
          <div className={styles.play}>
            <div className={styles.statusRow}>
              <SkullMascot expression={myTurn ? 'annoyed' : 'grudging'} size={56} />
              <span className={styles.status}>
                {myTurn ? 'Your move' : '🤖 thinking…'}
              </span>
              <span className={`badge ${symbol === 'X' ? 'badge-juice' : 'badge-pink'}`}>You are {symbol}</span>
            </div>
            {roast && <p className={`${styles.roast} anim-slide-up`} key={roast}>"{roast}"</p>}
            <XoxBoard board={board} onCell={handleCell} disabled={!myTurn || busy} lastCell={lastCell} />
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
          <GameOverCard
            won={won}
            draw={draw}
            mode="XOX"
            onPlayAgain={() => setPhase('SETUP')}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
    </div>
  )
}
