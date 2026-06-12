import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { recordGameForBadges } from '../services/badges.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameLogo from '../components/GameLogo.jsx'
import Loader from '../components/Loader.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import XoxBoard from '../components/match/XoxBoard.jsx'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { getModeRoast } from '../utils/roasts.js'
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
  const [result, setResult]         = useState(null)  // 'win' | 'lose' | 'draw' (board reveal)
  const [roast, setRoast]           = useState(null)
  const [busy, setBusy]             = useState(false)
  const [startErr, setStartErr]     = useState('')
  const [tutorialDone, setTutorialDone] = useState(false)

  const sessionRef  = useRef(null)
  const recordedRef = useRef(false)
  const games = user?.totalGames ?? totalGames

  async function startGame() {
    unlock()
    setStartErr('')
    setBusy(true)
    try {
      const data = await api.post('/game/start', { mode: 'XOX', difficulty, symbol, totalGames: games })
      sessionRef.current = data.sessionId
      setBoard(data.board)
      setTurn(data.turn)
      setLastCell(null)
      setOver(false); setWon(false); setDraw(false); setResult(null); setRoast(null)
      recordedRef.current = false
      setPhase('PLAYING')
    } catch (e) { setStartErr(e?.message || 'Could not start — please try again') }
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
        let r
        if (data.draw) { setDraw(true); r = 'draw'; playLose(); buzz('wrong') }
        else if (data.winner === data.playerSymbol) { setWon(true); r = 'win'; playWin(); buzz('correct') }
        else { r = 'lose'; playLose(); buzz('wrong') }
        setResult(r)
        setRoast(getModeRoast('XOX', r))   // mode-specific roast for the card
        // Let the finished board (winning line pulsing) sit before the card.
        setTimeout(() => setPhase('GAME_OVER'), 1800)
      } else {
        playTone(0.5)
      }
    } catch { buzz('error') }
    finally { setBusy(false) }
  }

  // On game over: badges (everyone) + stats (registered only)
  useEffect(() => {
    if (phase === 'GAME_OVER' && !recordedRef.current) {
      recordedRef.current = true
      const w = won && !draw
      recordGameForBadges({ mode: 'XOX', won: w })
      if (isRegistered) {
        api.post('/game/record', { mode: 'XOX', won: w })
          .then(d => { if (d.user) updateUser(d.user) })
          .catch(() => {})
      }
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
            <GameLogo variant="static" size={92} />
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
              {busy ? <><Loader inline size={16} />Starting…</> : '▶ Start'}
            </button>
            {startErr && <p style={{ color: 'var(--color-pink)', textAlign: 'center', marginTop: 'var(--space-2, 8px)' }}>{startErr}</p>}
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
            {result
              ? <div className={`${styles.resultBanner} anim-bounce-land`}>
                  {result === 'draw' ? '🤝 Draw!' : result === 'win' ? '🎉 You win!' : '💀 You lose'}
                </div>
              : roast && <p className={`${styles.roast} anim-slide-up`} key={roast}>"{roast}"</p>}
            <XoxBoard board={board} onCell={handleCell} disabled={!myTurn || busy || !!result} lastCell={lastCell} />
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
          <GameOverCard
            won={won}
            draw={draw}
            mode="XOX"
            roast={roast}
            onPlayAgain={() => setPhase('SETUP')}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
    </div>
  )
}
