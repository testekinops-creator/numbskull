import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import Avatar from '../components/avatar/Avatar.jsx'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import GuessList from '../components/game/GuessList.jsx'
import XoxBoard from '../components/match/XoxBoard.jsx'
import SosBoard from '../components/match/SosBoard.jsx'
import SudokuBoard from '../components/match/SudokuBoard.jsx'
import SpinBattleMatch from '../components/match/SpinBattleMatch.jsx'
import MathBattle from '../components/match/MathBattle.jsx'
import styles from './SpectatorPage.module.css'

const MODE_NAMES = { GTN: 'Guess The Number', BC: 'Bulls & Cows', XOX: 'Tic-Tac-Toe', MATH: 'Math Battle', SUDOKU: 'Sudoku', SPIN: 'Spin Battle', SOS: 'SOS', RMCS: 'Raja Mantri', RUMMY: 'Rummy' }
const noop = () => {}
const SPECTATOR_ID = '__spectator__'   // never matches a real player → no controls light up

export default function SpectatorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { state, spectate, unspectate } = useRoom()
  const { socket } = useSocket()
  const { isRegistered } = useAuth()
  const [liveRooms, setLiveRooms] = useState([])

  useEffect(() => {
    if (!socket) return
    if (roomId) {
      let cancelled = false
      // If the room is gone/not-allowed, don't hang on "Connecting…" — go to the list.
      spectate(roomId).then(r => { if (!cancelled && r && r.ok === false) navigate('/spectate', { replace: true }) })
      return () => { cancelled = true; unspectate(roomId) }   // leave the spectator list server-side
    }
    // Friends' live games (refresh every 5s so games appear/disappear live).
    const poll = () => socket.emit('room:watch_list', {}, r => { if (r?.ok) setLiveRooms(r.rooms) })
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // The watched room closed (both players left) → back to the live-games list.
  useEffect(() => {
    if (roomId && state.roomClosedByOpponent) navigate('/spectate', { replace: true })
  }, [roomId, state.roomClosedByOpponent, navigate])

  const room = state.room
  const match = state.match
  const players = room?.players || []

  // ── Live games list ──────────────────────────────────────────────────────
  if (!roomId) {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={`panel ${styles.spectator}`}>
          <div className={styles.header}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
            <h1 className={styles.title}>👀 Friends Live</h1>
          </div>
          {liveRooms.length === 0 ? (
            <p className={styles.empty}>
              {isRegistered
                ? 'None of your friends are in a game right now. Their live matches will appear here.'
                : 'Sign in and add friends to watch their live games here.'}
            </p>
          ) : (
            <ul className={styles.roomList}>
              {liveRooms.map(r => (
                <li key={r.id}>
                  <button className={`${styles.roomItem} card`} onClick={() => navigate(`/spectate/${r.id}`)}>
                    <span className={`badge badge-juice`}>{MODE_NAMES[r.mode] || r.mode}</span>
                    <span className={styles.roomPlayers}>{r.players.map(p => p.name).join(' vs ')}</span>
                    <span className={`badge badge-pink`}>🔴 LIVE{r.spectatorCount ? ` · 👁 ${r.spectatorCount}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  if (!room) {
    return <div className="screen"><div className={styles.loading}>Connecting to the game…</div></div>
  }

  const turnName = match?.turnId ? players.find(p => p.id === match.turnId)?.name : null
  const over = state.phase === 'GAME_OVER'
  const winnerName = state.winnerId ? players.find(p => p.id === state.winnerId)?.name : null

  function renderBoard() {
    if (!match) return <p className={styles.waiting}>Waiting for the game to start…</p>
    const p0 = players[0], p1 = players[1]
    switch (room.mode) {
      case 'XOX':
        return match.board ? <XoxBoard board={match.board} disabled /> : null
      case 'SOS':
        return match.board ? (
          <SosBoard size={match.size} board={match.board} lines={match.lines || []} pending={[]}
            mineId={p0?.id} onPlace={noop} onClaim={noop} disabled lastCell={state.sosLastCell} glow={false} />
        ) : null
      case 'SUDOKU':
        return match.grid ? (
          <SudokuBoard match={match} playerId={p0?.id} opponentId={p1?.id}
            onLock={noop} onUnlock={noop} onFill={noop} onClear={noop} />
        ) : null
      case 'SPIN':
        return match.wheel ? (
          <SpinBattleMatch match={match} you={SPECTATOR_ID} players={players} opponent={null}
            spin={state.spin} onSpin={noop} onGuess={noop} onBuyVowel={noop} onSolve={noop} />
        ) : null
      case 'MATH':
        return match.question ? (
          <MathBattle question={match.question}
            myScore={match.scores?.[p0?.id] ?? 0} oppScore={match.scores?.[p1?.id] ?? 0}
            oppName={p1?.name || 'P2'} onAnswer={noop} locked durationMs={15000} />
        ) : <p className={styles.waiting}>Next question…</p>
      case 'GTN':
      case 'BC':
        return <GuessList guesses={state.guesses} mode={room.mode} />
      default:
        return <p className={styles.waiting}>Live scores only for this game.</p>
    }
  }

  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={`panel ${styles.spectator}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/spectate')}>← All games</button>
          <span className={`badge badge-juice`}>{MODE_NAMES[room.mode] || room.mode}</span>
          <span className={styles.watching}>👁 {room.spectatorCount || 1}</span>
        </div>

        {/* Player scoreboard */}
        <div className={styles.hud}>
          {players.map(p => (
            <div key={p.id} className={`${styles.playerCard} ${match?.turnId === p.id ? styles.activeTurn : ''}`}>
              <Avatar seed={p.id} name={p.name} size={40} ring={match?.turnId === p.id ? 'cyan' : false} />
              <span className={styles.pName}>{p.name}{p.isBot ? ' 🤖' : ''}</span>
              <span className={styles.pScore}>{p.score ?? 0}</span>
            </div>
          ))}
        </div>

        <div className={styles.turnLine}>
          {over
            ? (state.draw ? "It's a draw!" : winnerName ? `🏆 ${winnerName} won!` : 'Game over')
            : turnName ? `${turnName}'s turn…` : 'Spectating live'}
        </div>

        {/* The live board (read-only). Isolated so a board glitch can't crash the page. */}
        <ErrorBoundary>
          <div className={styles.board}>{renderBoard()}</div>
        </ErrorBoundary>
      </div>
    </div>
  )
}
