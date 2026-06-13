import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import { useSocket } from '../../contexts/SocketContext.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { api } from '../../services/api.js'
import { recordGameForBadges } from '../../services/badges.js'
import GameLogo from '../GameLogo.jsx'
import Avatar from '../avatar/Avatar.jsx'
import GameOverCard from '../game/GameOverCard.jsx'
import RematchPrompt from '../game/RematchPrompt.jsx'
import TurnTimer from '../game/TurnTimer.jsx'
import EmojiBurst from '../game/EmojiBurst.jsx'
import ChatPanel from '../game/ChatPanel.jsx'
import RoomActionDock from '../game/RoomActionDock.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import RoomSocialCluster from '../game/RoomSocialCluster.jsx'
import RoomToasts from '../game/RoomToasts.jsx'
import MultiplayerTutorial from '../tutorial/MultiplayerTutorial.jsx'
import XoxBoard from './XoxBoard.jsx'
import MathBattle from './MathBattle.jsx'
import SudokuBoard from './SudokuBoard.jsx'
import SudokuMpHud from './SudokuMpHud.jsx'
import SosTimeoutFlash from './SosTimeoutFlash.jsx'
import TurnGlow from '../game/TurnGlow.jsx'
import SpinBattleMatch from './SpinBattleMatch.jsx'
import SosBoard from './SosBoard.jsx'
import RmcsMatch from './RmcsMatch.jsx'
import { useSound } from '../../hooks/useSound.js'
import { useHaptic } from '../../hooks/useHaptic.js'
import { useDelayedFlag } from '../../hooks/useDelayedFlag.js'
import { useAwayTimeout } from '../../hooks/useAwayTimeout.js'
import { getModeRoast } from '../../utils/roasts.js'
import roomStyles from '../../pages/RoomPage.module.css'
import styles from './MatchRoom.module.css'

const QUICK_EMOJIS = ['😂', '😈', '🔥', '💀', '🤡', '👑', '😭', '🧠']
const MODE_NAMES = { XOX: '⭕ Tic-Tac-Toe', MATH: '🧮 Math Battle', SUDOKU: '🔢 Sudoku', SPIN: '🎡 Spin Battle', SOS: '🔠 SOS', RMCS: '👑 Raja Mantri' }

export default function MatchRoom({ roomId, mode }) {
  const navigate = useNavigate()
  const {
    state, matchReady, hostStart, xoxMove, sosMove, sosClaim, matchForfeit, mathAnswer,
    sudokuLock, sudokuUnlock, sudokuFill, sudokuClear,
    spinSpin, spinGuess, spinVowel, spinSolve,
    rmcsReveal, rmcsGuess, rmcsNext, rmcsEnd, rmcsRematch, addBot, removeBot,
    requestRematch, acceptRematch, declineRematch, leaveRoom, clearRoom, reconnectRoom,
    sendChat, sendEmoji, clearUnreadChat,
  } = useRoom()
  const { playerId } = usePlayer()
  const { socket, connected } = useSocket()
  const { isRegistered, updateUser } = useAuth()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [chatOpen, setChatOpen] = useState(false)
  const [mathChoice, setMathChoice] = useState(null)
  const [copied, setCopied] = useState(false)
  const [resultRevealed, setResultRevealed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startErr, setStartErr] = useState('')
  const [rematching, setRematching] = useState(false)
  const [rematchErr, setRematchErr] = useState('')
  const [callActive, setCallActive] = useState(false)   // a voice call is live (lifts/widens the bottom chrome)
  const [confirmLeave, setConfirmLeave] = useState(false)   // premium "leave the game?" guard
  // Ignore a brief opponent drop (e.g. a page refresh) — only alarm after ~2.5s.
  const showOppLost = useDelayedFlag(connected && state.opponentConnLost, 2500)

  async function doHostStart() {
    setStartErr(''); setStarting(true)
    const r = await hostStart(roomId)
    if (!r?.ok) { setStartErr(r?.error || 'Could not start — try again'); setStarting(false) }
    // on success, match:start flips the phase and this lobby unmounts
  }

  async function doAddBot() { await addBot(roomId) }
  async function doFillBots() {
    const need = 4 - (room?.players?.length || 0)   // server caps at 4, so extra calls are no-ops
    for (let i = 0; i < need; i++) await addBot(roomId)
  }

  async function doRunItBack() {
    setRematchErr(''); setRematching(true)
    unlock()
    const r = await rmcsRematch(roomId)
    if (!r?.ok) { setRematchErr(r?.error || 'Could not restart — try again'); setRematching(false) }
    // on success, match:start flips the phase back to PLAYING and the card unmounts
  }

  const room = state.room
  const phase = room?.phase || 'IDLE'
  const me = room?.players?.find(p => p.id === playerId)
  const opponent = room?.players?.find(p => p.id !== playerId)
  const match = state.match
  const isParty = (room?.maxPlayers || 2) > 2          // 3–8 player party room
  const isHost = room?.hostId === playerId
  const showCall = !isParty && !!opponent              // voice is 1v1 only
  // Drop the call flag if call support goes away (opponent left / party room).
  useEffect(() => { if (!showCall) setCallActive(false) }, [showCall])
  // Reserve bottom space so the floating dock + call bar never sit over the board
  // or the result buttons. At game over the dock is tucked away, so we only need
  // to clear a lingering call pill (if a call is still live).
  const dockPad = phase === 'GAME_OVER'
    ? (callActive ? '72px' : 'var(--space-8, 32px)')
    : (callActive ? '156px' : '100px')

  // Is it the player's move right now? Drives the premium "your turn" glow around
  // the play area. Per-mode, since turn semantics differ (Sudoku is a free race
  // with no turns, so it never glows).
  const myMove = phase === 'PLAYING' && !!match && (() => {
    switch (mode) {
      case 'XOX':  return state.myTurn && !state.xoxRound
      case 'SOS':
      case 'SPIN': return state.myTurn
      case 'MATH': return !!match.question && !match.resolved && mathChoice == null
      case 'RMCS':
        if (match.stage === 'REVEAL') return !match.revealed?.[playerId]
        if (match.stage === 'GUESS')  return match.mantriId === playerId
        return false
      default:     return false   // SUDOKU: simultaneous race, no turn
    }
  })()

  const enteredRoomRef = useRef(false)
  useEffect(() => { if (room) enteredRoomRef.current = true }, [room])

  // (Clearing local room state + telling the server we left are both handled once
  // at the RoomPage route level, so the inner StrictMode/loading churn can't trip
  // them — see clearRoom + useLeaveOnExit in RoomPage.)

  // Reconnect + restore on mount and on every (re)connect.
  useEffect(() => {
    if (!socket || !roomId) return
    const doReconnect = async () => {
      const r = await reconnectRoom(roomId)
      if (r?.gone) navigate('/home')   // only leave if the room is truly over
    }
    doReconnect()
    socket.on('connect', doReconnect)
    return () => socket.off('connect', doReconnect)
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ready: these modes have no secret to set — just tell the server we're
  // here. When both players are ready the match starts. Re-fires after rematch
  // (phase returns to SETUP and me.ready resets to false).
  useEffect(() => {
    if (!room || !me || isParty) return  // party rooms wait for the host to start
    if (!((phase === 'SETUP' || phase === 'LOBBY') && opponent && !me.ready)) return
    // Retry on a slow/dropped connection so "Starting…" can't hang forever.
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < 6 && !cancelled; i++) {
        const r = await matchReady(roomId)
        if (cancelled || r?.ok) return
        await new Promise(res => setTimeout(res, 1500))
      }
    })()
    return () => { cancelled = true }
  }, [phase, me?.ready, opponent?.id, isParty]) // eslint-disable-line react-hooks/exhaustive-deps

  // Away too long (phone locked / app backgrounded past the reconnect grace) →
  // the room is dead; go to the game list instead of a stale board. Only while a
  // game is actually in progress, so we never yank you off the results screen.
  useAwayTimeout(!!room && phase !== 'GAME_OVER', () => { leaveRoom(roomId); navigate('/home') })

  // Keep the room's server-side TTL fresh while we're present. Turn-less / slow
  // games (e.g. SOS, which has no turn timer) don't refresh it via moves, so an
  // idle-but-present player would otherwise get evicted and bounced to the lobby.
  useEffect(() => {
    if (!socket || !roomId || phase === 'GAME_OVER') return
    const ping = () => socket.emit('room:heartbeat', { roomId })
    ping()                                   // touch immediately…
    const id = setInterval(ping, 120_000)    // …then every 2 min (well under the 10-min TTL)
    return () => clearInterval(id)
  }, [socket, roomId, phase])

  // Reconnected while the opponent was mid-grace: when their grace runs out the
  // server closes the room (and we get opponent_left), but guarantee we leave on
  // time even if that event is missed — go to the lobby at the close deadline.
  useEffect(() => {
    if (!state.opponentCloseAt) return
    const t = setTimeout(() => { leaveRoom(roomId); navigate('/home') },
      Math.max(0, state.opponentCloseAt - Date.now()) + 1500)
    return () => clearTimeout(t)
  }, [state.opponentCloseAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // SOS: a celebratory chime each time YOU claim a line (your score ticks up).
  const sosScoreRef = useRef(0)
  useEffect(() => {
    if (mode !== 'SOS') { sosScoreRef.current = 0; return }
    const my = state.match?.scores?.[playerId] ?? 0
    if (my > sosScoreRef.current) playWin()
    sosScoreRef.current = my
  }, [state.match?.scores, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Room closed (opponent left / declined) → brief message, then home.
  useEffect(() => {
    if (state.roomClosedByOpponent && enteredRoomRef.current) {
      const delay = state.opponentLeftMessage ? 1800 : 0
      const t = setTimeout(() => navigate('/home'), delay)
      return () => clearTimeout(t)
    }
  }, [state.roomClosedByOpponent, state.opponentLeftMessage, navigate])

  useEffect(() => {
    if (state.rematchStatus === 'declined') {
      const t = setTimeout(() => { leaveRoom(roomId); navigate('/home') }, 2200)
      return () => clearTimeout(t)
    }
  }, [state.rematchStatus, navigate, leaveRoom, roomId])

  // Sound: a click on each board change, win/lose chord on finish.
  const lastMoveCountRef = useRef(0)
  useEffect(() => {
    const filled = (match?.board || []).filter(c => c !== null).length
    if (filled > lastMoveCountRef.current) { playTone(0.5); buzz('wrong') }
    lastMoveCountRef.current = filled
  }, [match?.board]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'GAME_OVER') {
      if (state.draw) playLose()
      else if (state.won) playWin()
      else if (state.won === false) playLose()
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Offline banner (debounced).
  const [showOffline, setShowOffline] = useState(false)
  useEffect(() => {
    if (connected) { setShowOffline(false); return }
    const t = setTimeout(() => setShowOffline(true), 1200)
    return () => clearTimeout(t)
  }, [connected])

  // On the real PLAYING → GAME_OVER transition: badges (everyone) + stats
  // (registered). The monthly leaderboard is recorded server-side at match-end.
  const recordedRef = useRef(false)
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === 'PLAYING') recordedRef.current = false
    if (prev === 'PLAYING' && phase === 'GAME_OVER' && !recordedRef.current) {
      recordedRef.current = true
      const won = state.won === true
      recordGameForBadges({ mode, won, multiplayer: true, gtnRange1000Win: mode === 'GTN' && won })
      if (isRegistered) {
        api.post('/game/record', { mode, won })
          .then(d => { if (d.user) updateUser(d.user) })
          .catch(() => {})
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function openChat() { setChatOpen(true); clearUnreadChat() }

  // Live "how long have we been waiting" clock for the pre-game lobby. Driven by
  // the server's room.createdAt, so it survives refreshes and is the same for
  // every player.
  const [nowTs, setNowTs] = useState(Date.now())
  const inLobbyPhase = phase === 'LOBBY' || phase === 'SETUP'
  useEffect(() => {
    if (!inLobbyPhase) return
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [inLobbyPhase])
  const waitMs = room?.createdAt ? Math.max(0, nowTs - room.createdAt) : 0
  const waitClock = `${Math.floor(waitMs / 60000)}:${String(Math.floor(waitMs / 1000) % 60).padStart(2, '0')}`

  function copyCode() {
    navigator.clipboard?.writeText(room.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // XOX: let the finished board (with its winning line) sit for a beat before
  // showing the game-over card. Other modes reveal immediately.
  useEffect(() => {
    if (phase !== 'GAME_OVER') { setResultRevealed(false); return }
    if (mode !== 'XOX') { setResultRevealed(true); return }
    const t = setTimeout(() => setResultRevealed(true), 1800)
    return () => clearTimeout(t)
  }, [phase, mode])

  const resultText = state.draw ? '🤝 Draw!' : state.won ? '🎉 You win!' : '💀 You lose'
  const overRoast = useMemo(
    () => (phase === 'GAME_OVER' ? getModeRoast(mode, state.draw ? 'draw' : state.won ? 'win' : 'lose') : null),
    [phase, mode, state.won, state.draw],
  )

  function handleCell(i) {
    if (!state.myTurn || !match) return
    if (match.board?.[i] !== null) return
    unlock()
    xoxMove(roomId, i)
  }

  // Reset my picked option whenever a new Math question arrives.
  useEffect(() => { setMathChoice(null) }, [match?.question?.index])

  // Sound feedback when a Math question resolves.
  useEffect(() => {
    const lr = match?.lastResolved
    if (!lr) return
    if (lr.byPlayerId === playerId) { lr.correct ? playWin() : playLose() }
    else { playTone(0.3) }
  }, [match?.lastResolved]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleMathAnswer(choice) {
    if (!match || match.resolved) return
    unlock()
    setMathChoice(choice)
    mathAnswer(roomId, match.question.index, choice)
  }

  const mySymbol = match?.symbols?.[playerId]
  const mathReveal = match?.lastResolved
    ? {
        answer:  match.lastResolved.answer,
        byMe:    match.lastResolved.byPlayerId === playerId,
        correct: match.lastResolved.correct, // answerer's correctness (server-authoritative)
        timeout: match.lastResolved.timeout,
      }
    : null

  if (!room) {
    return (
      <div className="screen">
        <div className={roomStyles.loading}>
          <div className={roomStyles.spinner} />
          <p>Connecting to room…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <MultiplayerTutorial variant={mode === 'SPIN' ? 'spin' : mode === 'RMCS' ? 'rmcs' : mode === 'SUDOKU' ? 'sudoku' : mode === 'SOS' ? 'sos' : 'match'} />
      {mode === 'SOS' && <SosTimeoutFlash event={state.sosTimeout} playerId={playerId} opponentName={opponent?.name} />}
      <ConfirmDialog
        open={confirmLeave}
        icon="🚪"
        title="Leave the game?"
        message={phase === 'PLAYING' ? 'The match is in progress — leaving forfeits it to your opponent.' : 'You’ll leave this room and head back home.'}
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onConfirm={() => { setConfirmLeave(false); leaveRoom(roomId); navigate('/home') }}
        onCancel={() => setConfirmLeave(false)}
      />
      {showOffline && (
        <div className={`${roomStyles.connBanner} ${roomStyles.connOffline}`}>
          📡 You’re offline — reconnecting…
        </div>
      )}
      {showOppLost && (
        <div className={`${roomStyles.connBanner} ${roomStyles.connOppLost}`}>
          ⚠️ {opponent?.name || 'Opponent'} lost connection — waiting for them to return…
        </div>
      )}

      <div className={`panel ${roomStyles.roomPage}`} style={{ paddingBottom: dockPad }}>
        {/* Header */}
        <div className={roomStyles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(true)}>
            ✕ Leave
          </button>
          <span className="badge badge-juice">{MODE_NAMES[mode] || mode}</span>
          <span className={`badge ${room.isPublic ? 'badge-juice' : 'badge-pink'}`}>
            {room.isPublic ? 'Public' : room.code}
          </span>
        </div>

        {/* Room code while waiting for an opponent */}
        {phase === 'LOBBY' && (
          <div className={roomStyles.codeBox}>
            <p className={roomStyles.codeLabel}>Room Code</p>
            <div className={roomStyles.codeRow}>
              <span className={roomStyles.codeValue}>{room.code}</span>
              <button
                className={roomStyles.copyBtn}
                onClick={copyCode}
                title="Copy room code"
                aria-label="Copy room code"
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
            <p className={roomStyles.codeHint}>
              {copied ? '✓ Copied to clipboard!' : 'Share this code with a friend to invite them'}
            </p>
          </div>
        )}

        {/* Players — 1v1 HUD only. Party rooms (RMCS / SPIN 3–8) show the full
            roster inside the game itself, so a "You vs <one player>" row here
            would be wrong. */}
        {!isParty && (
        <div className={roomStyles.players}>
          <div className={`${roomStyles.playerSlot} ${me?.ready ? roomStyles.ready : ''}`}>
            <Avatar id={me?.avatar} seed={playerId} name={me?.name} size={44} ring="cyan" />
            <span className={roomStyles.playerName}>You {mySymbol ? `(${mySymbol})` : ''}</span>
            <span className={roomStyles.playerScore}>{me?.score ?? 0}</span>
          </div>
          {/* Call now lives in the action dock; the cluster keeps add-friend only. */}
          <RoomSocialCluster roomId={roomId} opponent={opponent} allowVoice={false} />
          {opponent ? (
            <div className={`${roomStyles.playerSlot} ${opponent?.ready ? roomStyles.ready : ''}`}>
              <Avatar id={opponent?.avatar} seed={opponent?.id} name={opponent?.name} size={44} />
              <span className={roomStyles.playerName}>
                {opponent.name} {match?.symbols?.[opponent.id] ? `(${match.symbols[opponent.id]})` : ''}
              </span>
              <span className={roomStyles.playerScore}>{opponent?.score ?? 0}</span>
            </div>
          ) : (
            <div className={roomStyles.waitingSlot}>
              <div className={roomStyles.spinner} />
              <span>Waiting…</span>
            </div>
          )}
        </div>
        )}

        {/* Roast line (kept) — the redundant mid-screen skull was removed; the
            Game Over card carries its own skull as the centrepiece. */}
        {state.roast && (
          <p className={`${roomStyles.roast} anim-slide-up`} key={state.roast} style={{ textAlign: 'center' }}>"{state.roast}"</p>
        )}

        {/* SETUP — party lobby (host starts) or 1v1 auto-ready */}
        {(phase === 'SETUP' || phase === 'LOBBY') && (
          isParty ? (
            <div className={styles.partyLobby}>
              <p className={styles.partyTitle}>Party room · {room.players.length}/{room.maxPlayers}</p>
              <p className={styles.waitClock}>⏱ Waiting {waitClock}</p>
              <ul className={styles.partyList}>
                {room.players.map(p => (
                  <li key={p.id} className={styles.partyItem}>
                    <Avatar id={p.avatar} seed={p.id} name={p.name} size={32} ring={p.id === room.hostId ? 'gold' : false} />
                    <span className={styles.partyItemName}>{p.name}{p.id === playerId ? ' (you)' : ''}</span>
                    {p.isBot && <span className={styles.partyBotTag}>🤖 bot</span>}
                    {p.id === room.hostId && <span className={styles.partyHostTag}>👑 host</span>}
                    {isHost && p.isBot && (
                      <button className={styles.botRemove} onClick={() => removeBot(roomId, p.id)} aria-label="Remove bot" title="Remove bot">✕</button>
                    )}
                  </li>
                ))}
              </ul>
              <p className={styles.partyCode}>Share code: <b>{room.code}</b></p>
              {/* RMCS: short a player? fill empty seats with bots so you can start now. */}
              {isHost && mode === 'RMCS' && room.players.length < 4 && (
                <div className={styles.botRow}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={doAddBot}>🤖 Add bot</button>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={doFillBots}>Fill with bots</button>
                </div>
              )}
              {isHost ? (
                <>
                  {/* RMCS needs the full court of 4; other party modes start at 2+. */}
                  <button className="btn btn-juice btn-lg" style={{ width: '100%' }}
                    disabled={room.players.length < (mode === 'RMCS' ? 4 : 2) || starting} onClick={doHostStart}>
                    {starting ? 'Starting…'
                      : mode === 'RMCS' && room.players.length < 4 ? `Waiting for players… ${room.players.length}/4`
                      : room.players.length < 2 ? 'Waiting for players…'
                      : `Start · ${room.players.length} players`}
                  </button>
                  {startErr && <p className={roomStyles.errorText || ''} style={{ color: 'var(--color-pink)', marginTop: 8 }}>{startErr}</p>}
                </>
              ) : (
                <p className={roomStyles.waitingText}>Waiting for the host to start…</p>
              )}
            </div>
          ) : (
            <p className={roomStyles.waitingText}>
              {opponent ? 'Starting…' : <>Waiting for an opponent to join… <b>⏱ {waitClock}</b></>}
            </p>
          )
        )}

        {/* PLAYING */}
        {phase === 'PLAYING' && match && (
          <div className={styles.playArea}>
            {mode === 'XOX' && (
              <>
                {match.series && (
                  <p className={styles.seriesLine}>
                    Best of {(match.roundsToWin || 2) * 2 - 1} · Round {match.gameNo || 1} ·{' '}
                    <b>You {match.series[playerId] || 0}</b> — <b>{opponent ? (match.series[opponent.id] || 0) : 0} {opponent?.name || 'Opp'}</b>
                  </p>
                )}
                {state.xoxRound && !state.xoxRound.matchOver ? (
                  <>
                    <div className={`${styles.resultBanner} anim-bounce-land`}>
                      {state.xoxRound.draw
                        ? 'Round drawn — replay!'
                        : `${state.xoxRound.winnerId === playerId ? 'You' : (opponent?.name || 'Opponent')} won round ${state.xoxRound.gameNo} — next round…`}
                    </div>
                    <XoxBoard board={match.board} disabled />
                  </>
                ) : (
                  <>
                    <TurnTimer active={state.myTurn} seconds={state.turnTimeLeft} total={state.turnTimeTotal} />
                    <p key={state.myTurn ? 'me' : 'opp'} className={`${styles.turnLabel} anim-msg`}>
                      {state.myTurn ? 'Your move' : `${opponent?.name || 'Opponent'} is playing…`}
                    </p>
                    <TurnGlow active={myMove} maxWidth={332}>
                      <XoxBoard board={match.board} onCell={handleCell} disabled={!state.myTurn} />
                    </TurnGlow>
                  </>
                )}
              </>
            )}
            {mode === 'MATH' && match.question && (
              <TurnGlow active={myMove} maxWidth={432}>
                <MathBattle
                  question={match.question}
                  myScore={match.scores?.[playerId] ?? 0}
                  oppScore={opponent ? (match.scores?.[opponent.id] ?? 0) : 0}
                  oppName={opponent?.name || 'Opponent'}
                  onAnswer={handleMathAnswer}
                  locked={match.resolved}
                  myChoice={mathChoice}
                  reveal={mathReveal}
                  durationMs={15000}
                />
              </TurnGlow>
            )}
            {mode === 'SUDOKU' && match.grid && (
              <>
                <SudokuMpHud match={match} playerId={playerId} opponent={opponent} />
                <SudokuBoard
                  match={match}
                  playerId={playerId}
                  opponentId={opponent?.id}
                  onLock={(i) => sudokuLock(roomId, i)}
                  onUnlock={(i) => sudokuUnlock(roomId, i)}
                  onFill={(i, v) => { unlock(); sudokuFill(roomId, i, v) }}
                  onClear={(i) => sudokuClear(roomId, i)}
                />
              </>
            )}
            {mode === 'SPIN' && match.wheel && (
              <TurnGlow active={myMove} maxWidth={468}>
                <SpinBattleMatch
                  match={match}
                  you={playerId}
                  players={room.players}
                  opponent={opponent}
                  spin={state.spin}
                  onSpin={() => { unlock(); spinSpin(roomId) }}
                  onGuess={(l) => { unlock(); spinGuess(roomId, l) }}
                  onBuyVowel={(l) => { unlock(); spinVowel(roomId, l) }}
                  onSolve={(t) => { unlock(); spinSolve(roomId, t) }}
                />
              </TurnGlow>
            )}
            {mode === 'RMCS' && match.stage && (
              <TurnGlow active={myMove} maxWidth={432}>
                <RmcsMatch
                  match={match}
                  you={playerId}
                  players={room.players}
                  hostId={room.hostId}
                  onReveal={() => rmcsReveal(roomId)}
                  onGuess={(suspectId) => rmcsGuess(roomId, suspectId)}
                  onNext={() => rmcsNext(roomId)}
                  onEnd={() => rmcsEnd(roomId)}
                />
              </TurnGlow>
            )}
            {mode === 'SOS' && match.board && (() => {
              const myPending = match.pendingBy === playerId ? (match.pending || []) : []
              const claiming = myPending.length > 0
              const myScore  = match.scores?.[playerId] ?? 0
              const oppScore = opponent ? (match.scores?.[opponent.id] ?? 0) : 0
              return (
                <>
                  <div className={styles.sosHud}>
                    <span className={`${styles.hudScore} ${styles.hudMe}`}>You <b>{myScore}</b></span>
                    <span key={claiming ? 'c' : state.myTurn ? 't' : 'o'} className={`${styles.turnLabel} anim-msg`}>
                      {claiming ? '✏️ Draw your S‑O‑S!' : state.myTurn ? '🫵 Your move' : `⏳ ${opponent?.name || 'Opponent'}…`}
                    </span>
                    <span className={styles.hudScore}>{opponent?.name || 'Opp'} <b>{oppScore}</b></span>
                  </div>
                  <TurnTimer active={state.myTurn} seconds={state.turnTimeLeft} total={state.turnTimeTotal} />
                  <SosBoard
                    size={match.size}
                    board={match.board}
                    lines={match.lines || []}
                    pending={myPending}
                    mineId={playerId}
                    onPlace={(i, letter) => { unlock(); playTone(0.4); sosMove(roomId, i, letter) }}
                    onClaim={(cells) => { unlock(); sosClaim(roomId, cells) }}
                    disabled={!state.myTurn}
                    lastCell={state.sosLastCell}
                    glow={myMove || claiming}
                  />
                </>
              )
            })()}
          </div>
        )}

        {/* GAME OVER — XOX shows the finished board + result banner first */}
        {phase === 'GAME_OVER' && mode === 'XOX' && !resultRevealed && match?.board && (
          <div className={styles.playArea}>
            <div className={`${styles.resultBanner} anim-bounce-land`}>{resultText}</div>
            <XoxBoard board={match.board} disabled />
          </div>
        )}

        {phase === 'GAME_OVER' && (mode !== 'XOX' || resultRevealed) && (
          isParty && state.ranking ? (
            <div className={styles.rankCard}>
              <h2 className={styles.rankTitle}>Final standings</h2>
              {state.draw && <p className={`${styles.resultBanner} anim-bounce-land`}>🤝 It's a tie!</p>}
              <ol className={styles.rankList}>
                {state.ranking.map(r => (
                  <li key={r.id} className={`${styles.rankItem} ${r.id === playerId ? styles.rankYou : ''}`}>
                    <span className={styles.rankPos}>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`}</span>
                    <Avatar id={room.players.find(p => p.id === r.id)?.avatar} seed={r.id} name={r.name}
                      size={36} ring={r.rank === 1 ? 'gold' : false} />
                    <span className={styles.rankName}>{r.name}{r.id === playerId ? ' (you)' : ''}</span>
                    {/* SPIN rankings carry roundWins/trophies; RMCS carries point totals. */}
                    {r.total != null ? (
                      <span className={styles.rankWins}>{r.total} pts</span>
                    ) : (
                      <>
                        <span className={styles.rankWins}>{r.roundWins}W</span>
                        <span className={`${styles.rankTrophy} ${r.trophies >= 0 ? styles.trophyPos : styles.trophyNeg}`}>
                          {r.trophies >= 0 ? `+${r.trophies}` : r.trophies}🏆
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {/* RMCS host can re-deal a fresh game with the same 4 players. */}
              {mode === 'RMCS' && isHost && room.players.length === 4 && (
                <button className="btn btn-juice btn-lg" style={{ width: '100%' }} disabled={rematching} onClick={doRunItBack}>
                  {rematching ? 'Dealing…' : '🔁 Run it back'}
                </button>
              )}
              {rematchErr && <p style={{ color: 'var(--color-pink)', textAlign: 'center', margin: 0 }}>{rematchErr}</p>}
              {mode === 'RMCS' && !isHost && room.players.length === 4 && (
                <p className={styles.seriesLine}>Waiting for the host to run it back…</p>
              )}
              <button
                className={`btn ${mode === 'RMCS' && isHost && room.players.length === 4 ? 'btn-ghost' : 'btn-juice'} btn-lg`}
                style={{ width: '100%' }}
                onClick={() => { leaveRoom(roomId); navigate('/home') }}
              >
                Home
              </button>
            </div>
          ) : (
          <>
            <GameOverCard
              won={state.won}
              draw={state.draw}
              mode={mode}
              roast={overRoast}
              scores={room?.players}
              multiplayer
              onPlayAgain={null}
              onHome={() => { leaveRoom(roomId); navigate('/home') }}
            />
            {state.won && state.overReason === 'opponent_left' && (
              <p className={styles.seriesLine}>🚪 Opponent left — you win by forfeit.</p>
            )}
            {mode === 'SUDOKU' && match && (
              <>
                {state.overReason === 'mistakes' && (
                  <p className={styles.sudokuEndStats}>
                    💥 {state.won ? 'Your opponent' : 'You'} hit the {match.mistakeLimit}-mistake limit.
                  </p>
                )}
                <p className={styles.sudokuEndStats}>
                  ✅ {match.correctCount}/{match.fillTarget} cells correct · ❌ {match.wrongCount} wrong attempts
                </p>
              </>
            )}
            {mode === 'XOX' && state.seriesScore && (
              <p className={styles.seriesLine}>
                Series: <b>{state.seriesScore[playerId] || 0}</b> — <b>{opponent ? (state.seriesScore[opponent.id] || 0) : 0}</b>
              </p>
            )}
            <RematchPrompt
              rematchStatus={state.rematchStatus}
              requesterName={state.rematchRequesterName}
              myName={me?.name}
              onPlayAgain={() => requestRematch(roomId)}
              onAccept={() => acceptRematch(roomId)}
              onDecline={() => { declineRematch(roomId); navigate('/home') }}
              onHome={() => { leaveRoom(roomId); navigate('/home') }}
            />
          </>
          )
        )}
      </div>

      {/* Opponent-left overlay */}
      {state.opponentLeftMessage && (
        <div className={roomStyles.leftOverlay} role="alert">
          <div className={`${roomStyles.leftCard} anim-bounce-land`}>
            <GameLogo variant="static" size={72} />
            <h2 className={roomStyles.leftTitle}>{state.opponentLeftMessage}</h2>
            <p className={roomStyles.leftSub}>Taking you back home…</p>
          </div>
        </div>
      )}

      <EmojiBurst trigger={state.lastEmoji} />

      {/* Premium action dock — emoji · chat · call (1v1) · help · music. Tucked
          away at game over so it can't cover the Play Again / Home buttons (the
          call pill, if any, stays — a call isn't dropped just because the game ended). */}
      <RoomActionDock
        roomId={roomId}
        mode={mode}
        hasOpponent={!!opponent}
        showCall={showCall}
        opponentName={opponent?.name}
        unread={state.unreadChat}
        callActive={callActive}
        onCallActiveChange={setCallActive}
        tuckedAway={phase === 'GAME_OVER'}
        mute={match?.kind === 'RMCS' && match.modifier === 'SILENT' && (match.stage === 'REVEAL' || match.stage === 'GUESS')}
        onEmoji={(e) => sendEmoji(roomId, e)}
        onOpenChat={openChat}
      />

      <RoomToasts roomId={roomId} />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={state.chatMessages}
        players={room?.players || []}
        onSend={(text) => sendChat(roomId, text)}
      />
    </div>
  )
}
