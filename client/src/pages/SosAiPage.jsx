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
import SosBoard from '../components/match/SosBoard.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { getModeRoast } from '../utils/roasts.js'
import styles from './SosAiPage.module.css'

const SIZES = [[8, '8 × 8'], [10, '10 × 10']]
const DIFFS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
const triKey = (t) => [...t].sort((a, b) => a - b).join(',')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export default function SosAiPage() {
  const navigate = useNavigate()
  const { isRegistered, updateUser, user } = useAuth()
  const { totalGames } = usePlayer()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [phase, setPhase]           = useState('SETUP')   // SETUP | PLAYING | GAME_OVER
  const [boardSize, setBoardSize]   = useState(8)
  const [difficulty, setDifficulty] = useState('medium')
  const [size, setSize]             = useState(8)
  const [board, setBoard]           = useState([])
  const [scores, setScores]         = useState({ player: 0, ai: 0 })
  const [turn, setTurn]             = useState('player')
  const [lines, setLines]           = useState([])        // drawn/claimed lines
  const [pending, setPending]       = useState([])        // your formed lines awaiting a draw
  const [lastCell, setLastCell]     = useState(null)
  const [over, setOver]             = useState(false)
  const [winner, setWinner]         = useState(null)
  const [roast, setRoast]           = useState(null)
  const [busy, setBusy]             = useState(false)
  const [startErr, setStartErr]     = useState('')

  const sessionRef  = useRef(null)
  const recordedRef = useRef(false)
  const games = user?.totalGames ?? totalGames

  async function startGame() {
    unlock(); setStartErr(''); setBusy(true)
    try {
      const data = await api.post('/game/start', { mode: 'SOS', boardSize, difficulty, totalGames: games })
      sessionRef.current = data.sessionId
      setSize(data.size); setBoard(data.board); setScores(data.scores || { player: 0, ai: 0 })
      setTurn(data.turn); setLines([]); setPending([]); setLastCell(null)
      setOver(false); setWinner(null); setRoast(null)
      recordedRef.current = false
      setPhase('PLAYING')
    } catch (e) { setStartErr(e?.message || 'Could not start — please try again') }
    finally { setBusy(false) }
  }

  async function handlePlace(i, letter) {
    if (busy || over || turn !== 'player' || pending.length || board[i] !== null) return
    unlock(); setBusy(true)
    try {
      const data = await api.post('/game/sos/move', { cell: i, letter, sessionId: sessionRef.current, totalGames: games })
      if (!data.valid) { buzz('error'); return }
      const formed = data.formed || []

      if (formed.length) {
        // You scored — show your placement; the lines you formed stay "pending"
        // until you draw them. The AI hasn't moved yet (bonus turn is yours).
        const formedKeys = new Set(formed.map(t => triKey(t)))
        setBoard(data.board)
        setScores(data.scores)
        setTurn(data.turn); setOver(data.over); setWinner(data.winner)
        setLines((data.lines || []).filter(l => !formedKeys.has(triKey(l.cells))))
        setPending(formed)
        setLastCell(i)
        playTone(0.5); buzz('correct')
        return
      }

      // No S–O–S for you → the AI takes its turn. Replay it move-by-move at a
      // human pace so the opponent's play is readable, not instant.
      const aiMoves = data.aiMoves || []
      let b = [...board]; b[i] = letter
      setBoard(b); setLastCell(i); setTurn('ai'); playTone(0.4)
      let ln = lines
      for (const mv of aiMoves) {
        await sleep(620 + Math.random() * 380)
        b = [...b]; b[mv.cell] = mv.letter
        setBoard(b); setLastCell(mv.cell); playTone(0.4)
        if (mv.lines?.length) {
          await sleep(350)
          ln = [...ln, ...mv.lines.map(c => ({ cells: c, by: 'ai' }))]
          setLines(ln); buzz('wrong')
        }
      }
      // Reconcile with the authoritative server state.
      setScores(data.scores); setTurn(data.turn); setOver(data.over); setWinner(data.winner)
      setLines(data.lines || ln)
    } catch { buzz('error') }
    finally { setBusy(false) }
  }

  function handleClaim(cells) {
    setPending(prev => prev.filter(t => triKey(t) !== triKey(cells)))
    setLines(prev => [...prev, { cells, by: 'player' }])
    playWin(); buzz('correct')
  }

  // When the game is over AND you've drawn every line you earned → reveal the card.
  useEffect(() => {
    if (phase !== 'PLAYING' || !over || pending.length) return
    const r = winner === 'player' ? 'win' : winner === null ? 'draw' : 'lose'
    setRoast(getModeRoast('SOS', r))
    if (r === 'win') playWin(); else playLose()
    const t = setTimeout(() => setPhase('GAME_OVER'), 1400)
    return () => clearTimeout(t)
  }, [over, pending, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // On game over: badges (everyone) + stats (registered only).
  useEffect(() => {
    if (phase === 'GAME_OVER' && !recordedRef.current) {
      recordedRef.current = true
      const won = winner === 'player'
      recordGameForBadges({ mode: 'SOS', won })
      if (isRegistered) {
        api.post('/game/record', { mode: 'SOS', won }).then(d => { if (d.user) updateUser(d.user) }).catch(() => {})
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const claiming = pending.length > 0
  const myTurn = phase === 'PLAYING' && turn === 'player' && !over

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <span className="badge badge-juice">🔠 SOS</span>
          <span className={styles.vsTag}>vs 🤖</span>
        </div>

        {phase === 'SETUP' && (
          <div className={`${styles.setup} anim-slide-up`}>
            <GameLogo variant="static" size={88} />
            <h1 className={styles.setupTitle}>SOS</h1>
            <p className={styles.setupHint}>Make an <b>S‑O‑S</b> in any direction, draw the line to score, and go again.</p>

            <div className={styles.choiceLabel}>Grid size</div>
            <div className={styles.row}>
              {SIZES.map(([v, label]) => (
                <button key={v} className={`${styles.choiceBtn} ${boardSize === v ? styles.choiceActive : ''}`} onClick={() => setBoardSize(v)}>{label}</button>
              ))}
            </div>

            <div className={styles.choiceLabel}>Difficulty</div>
            <div className={styles.row}>
              {DIFFS.map(([id, label]) => (
                <button key={id} className={`${styles.choiceBtn} ${difficulty === id ? styles.choiceActive : ''}`} onClick={() => setDifficulty(id)}>{label}</button>
              ))}
            </div>

            <button className="btn btn-juice btn-lg" style={{ width: '100%', marginTop: 'var(--space-4, 16px)' }} onClick={startGame} disabled={busy}>
              {busy ? <><Loader inline size={16} />Starting…</> : '▶ Start'}
            </button>
            {startErr && <p style={{ color: 'var(--color-pink)', textAlign: 'center', marginTop: 'var(--space-2, 8px)' }}>{startErr}</p>}
          </div>
        )}

        {phase === 'PLAYING' && (
          <div className={styles.play}>
            <div className={styles.statusRow}>
              <SkullMascot expression={myTurn ? 'annoyed' : 'grudging'} size={52} />
              <span className={styles.status}>
                {claiming ? '✏️ Draw your S‑O‑S!' : myTurn ? 'Your move' : '🤖 thinking…'}
              </span>
              <span className={styles.scoreTag}>You <b>{scores.player}</b> · 🤖 <b>{scores.ai}</b></span>
            </div>
            <SosBoard
              size={size}
              board={board}
              lines={lines}
              pending={pending}
              mineId="player"
              onPlace={handlePlace}
              onClaim={handleClaim}
              disabled={!myTurn || busy}
              lastCell={lastCell}
            />
          </div>
        )}

        {phase === 'GAME_OVER' && (
          <GameOverCard
            won={winner === 'player'}
            draw={winner === null}
            mode="SOS"
            roast={roast}
            onPlayAgain={() => setPhase('SETUP')}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
    </div>
  )
}
