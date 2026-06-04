import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import { useSocket } from '../../contexts/SocketContext.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { api } from '../../services/api.js'
import SkullMascot from '../skull/SkullMascot.jsx'
import GameOverCard from '../game/GameOverCard.jsx'
import RematchPrompt from '../game/RematchPrompt.jsx'
import TurnTimer from '../game/TurnTimer.jsx'
import EmojiBurst from '../game/EmojiBurst.jsx'
import ChatPanel from '../game/ChatPanel.jsx'
import XoxBoard from './XoxBoard.jsx'
import { useSound } from '../../hooks/useSound.js'
import { useHaptic } from '../../hooks/useHaptic.js'
import roomStyles from '../../pages/RoomPage.module.css'
import styles from './MatchRoom.module.css'

const QUICK_EMOJIS = ['😂', '😈', '🔥', '💀', '🤡', '👑', '😭', '🧠']
const MODE_NAMES = { XOX: '⭕ Tic-Tac-Toe', MATH: '🧮 Math Battle', SUDOKU: '🔢 Sudoku' }

export default function MatchRoom({ roomId, mode }) {
  const navigate = useNavigate()
  const {
    state, matchReady, xoxMove, matchForfeit,
    requestRematch, acceptRematch, declineRematch, leaveRoom, clearRoom, reconnectRoom,
    sendChat, sendEmoji, clearUnreadChat,
  } = useRoom()
  const { playerId } = usePlayer()
  const { socket, connected } = useSocket()
  const { isRegistered, updateUser } = useAuth()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [chatOpen, setChatOpen] = useState(false)

  const room = state.room
  const phase = room?.phase || 'IDLE'
  const me = room?.players?.find(p => p.id === playerId)
  const opponent = room?.players?.find(p => p.id !== playerId)
  const match = state.match

  const enteredRoomRef = useRef(false)
  useEffect(() => { if (room) enteredRoomRef.current = true }, [room])

  // Clear local room state when leaving the page.
  useEffect(() => () => clearRoom(), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect + restore on mount and on every (re)connect.
  useEffect(() => {
    if (!socket || !roomId) return
    const doReconnect = async () => {
      const r = await reconnectRoom(roomId)
      if (!r?.ok) navigate('/home')
    }
    doReconnect()
    socket.on('connect', doReconnect)
    return () => socket.off('connect', doReconnect)
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ready: these modes have no secret to set — just tell the server we're
  // here. When both players are ready the match starts. Re-fires after rematch
  // (phase returns to SETUP and me.ready resets to false).
  useEffect(() => {
    if (!room || !me) return
    if ((phase === 'SETUP' || phase === 'LOBBY') && opponent && !me.ready) {
      matchReady(roomId)
    }
  }, [phase, me?.ready, opponent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Record the result once, on the real PLAYING → GAME_OVER transition.
  const recordedRef = useRef(false)
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === 'PLAYING') recordedRef.current = false
    if (prev === 'PLAYING' && phase === 'GAME_OVER' && isRegistered && !recordedRef.current) {
      recordedRef.current = true
      api.post('/game/record', { mode, won: state.won === true })
        .then(d => { if (d.user) updateUser(d.user) })
        .catch(() => {})
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function openChat() { setChatOpen(true); clearUnreadChat() }

  function handleCell(i) {
    if (!state.myTurn || !match) return
    if (match.board?.[i] !== null) return
    unlock()
    xoxMove(roomId, i)
  }

  const mySymbol = match?.symbols?.[playerId]

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
      {showOffline && (
        <div className={`${roomStyles.connBanner} ${roomStyles.connOffline}`}>
          📡 You’re offline — reconnecting…
        </div>
      )}
      {connected && state.opponentConnLost && (
        <div className={`${roomStyles.connBanner} ${roomStyles.connOppLost}`}>
          ⚠️ {opponent?.name || 'Opponent'} lost connection — waiting for them to return…
        </div>
      )}

      <div className={`panel ${roomStyles.roomPage}`}>
        {/* Header */}
        <div className={roomStyles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => { leaveRoom(roomId); navigate('/home') }}>
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
            </div>
            <p className={roomStyles.codeHint}>Share this code with a friend to invite them</p>
          </div>
        )}

        {/* Players */}
        <div className={roomStyles.players}>
          <div className={`${roomStyles.playerSlot} ${me?.ready ? roomStyles.ready : ''}`}>
            <span className={roomStyles.playerName}>You {mySymbol ? `(${mySymbol})` : ''}</span>
            <span className={roomStyles.playerScore}>{me?.score ?? 0}</span>
          </div>
          <span className={roomStyles.vs}>vs</span>
          {opponent ? (
            <div className={`${roomStyles.playerSlot} ${opponent?.ready ? roomStyles.ready : ''}`}>
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

        {/* Skull + roast */}
        <div className={roomStyles.skullRow}>
          <SkullMascot expression={phase === 'GAME_OVER' ? 'grudging' : 'annoyed'} size={72} />
          {state.roast && <p className={`${roomStyles.roast} anim-slide-up`} key={state.roast}>"{state.roast}"</p>}
        </div>

        {/* SETUP — auto-readying / waiting */}
        {(phase === 'SETUP' || (phase === 'LOBBY' && opponent)) && (
          <p className={roomStyles.waitingText}>
            {opponent ? 'Starting…' : `Waiting for an opponent to join…`}
          </p>
        )}

        {/* PLAYING */}
        {phase === 'PLAYING' && match && (
          <div className={styles.playArea}>
            <TurnTimer active={state.myTurn} seconds={state.turnTimeLeft} />
            <p className={styles.turnLabel}>
              {state.myTurn ? 'Your move' : `${opponent?.name || 'Opponent'} is playing…`}
            </p>
            {mode === 'XOX' && (
              <XoxBoard
                board={match.board}
                onCell={handleCell}
                disabled={!state.myTurn}
              />
            )}
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
          <>
            <GameOverCard
              won={state.won}
              draw={state.draw}
              mode={mode}
              scores={room?.players}
              multiplayer
              onPlayAgain={null}
              onHome={() => { leaveRoom(roomId); navigate('/home') }}
            />
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
        )}
      </div>

      {/* Opponent-left overlay */}
      {state.opponentLeftMessage && (
        <div className={roomStyles.leftOverlay} role="alert">
          <div className={`${roomStyles.leftCard} anim-bounce-land`}>
            <SkullMascot expression="grudging" size={72} />
            <h2 className={roomStyles.leftTitle}>{state.opponentLeftMessage}</h2>
            <p className={roomStyles.leftSub}>Taking you back home…</p>
          </div>
        </div>
      )}

      <EmojiBurst trigger={state.lastEmoji} />

      {/* Chat / emoji bar */}
      {opponent && (
        <div className={roomStyles.chatBar}>
          <div className={roomStyles.emojiRow}>
            {QUICK_EMOJIS.map(e => (
              <button key={e} className={roomStyles.emojiBtn} onClick={() => sendEmoji(roomId, e)} aria-label={`Send ${e}`}>
                {e}
              </button>
            ))}
          </div>
          <button className={roomStyles.chatToggle} onClick={openChat} aria-label="Open chat">
            💬
            {state.unreadChat > 0 && <span className={roomStyles.unreadDot}>{state.unreadChat}</span>}
          </button>
        </div>
      )}

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={state.chatMessages}
        onSend={(text) => sendChat(roomId, text)}
      />
    </div>
  )
}
