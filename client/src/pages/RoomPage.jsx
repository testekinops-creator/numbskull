import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GuessList from '../components/game/GuessList.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import RematchPrompt from '../components/game/RematchPrompt.jsx'
import TurnTimer from '../components/game/TurnTimer.jsx'
import { getSkullExpression } from '../utils/personality.js'
import styles from './RoomPage.module.css'

export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { state, setReady, submitGuess, requestRematch, acceptRematch, declineRematch, leaveRoom } = useRoom()
  const { playerId } = usePlayer()
  const { socket } = useSocket()

  const [secret, setSecret] = useState('')
  const [guess, setGuess] = useState('')
  const [secretError, setSecretError] = useState('')
  const [guessError, setGuessError] = useState('')
  const inputRef = useRef(null)
  // Keep the secret visible during gameplay after Ready is clicked
  const mySecretRef = useRef('')

  const room = state.room
  const mode = room?.mode || 'GTN'
  const phase = room?.phase || 'IDLE'
  const me = room?.players?.find(p => p.id === playerId)
  const opponent = room?.players?.find(p => p.id !== playerId)
  const isMyTurn = state.myTurn

  useEffect(() => {
    if (!socket || !roomId) return
    socket.emit('room:reconnect', { roomId }, r => {
      if (!r.ok) navigate('/')
    })
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only navigate home if the flag flips WHILE we have a room loaded
  // (guards against stale flag from previous session navigating immediately on mount)
  useEffect(() => {
    if (state.roomClosedByOpponent && room) navigate('/')
  }, [state.roomClosedByOpponent, navigate, room])

  // When my request was declined, auto-navigate home after showing message
  useEffect(() => {
    if (state.rematchStatus === 'declined') {
      const t = setTimeout(() => { leaveRoom(roomId); navigate('/') }, 2500)
      return () => clearTimeout(t)
    }
  }, [state.rematchStatus, navigate, leaveRoom, roomId])

  useEffect(() => {
    if (isMyTurn && phase === 'PLAYING') inputRef.current?.focus()
  }, [isMyTurn, phase])

  function handleReady(e) {
    e.preventDefault()
    if (mode === 'GTN') {
      const n = parseInt(secret, 10)
      if (!secret || isNaN(n) || n < 1 || n > 100) {
        setSecretError('Enter a number between 1 and 100')
        return
      }
    }
    if (mode === 'BC') {
      const s = secret.trim()
      if (!/^\d{4}$/.test(s) || new Set(s).size !== 4) {
        setSecretError('Enter 4 unique digits for your secret')
        return
      }
    }
    setSecretError('')
    mySecretRef.current = secret.trim()   // save for display during gameplay
    setReady(roomId, secret.trim())
  }

  function handleGuess(e) {
    e.preventDefault()
    const val = guess.trim()
    if (!val) return
    if (mode === 'GTN') {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1 || n > 100) { setGuessError('Enter 1–100'); return }
    } else {
      if (!/^\d{4}$/.test(val)) { setGuessError('4 digits'); return }
      if (new Set(val).size !== 4) { setGuessError('All different'); return }
    }
    setGuessError('')
    setGuess('')
    submitGuess(roomId, mode === 'GTN' ? parseInt(val, 10) : val)
  }

  const expression = getSkullExpression(state.lastGuessResult, phase === 'GAME_OVER' ? 'GAME_OVER' : 'PLAYING')

  if (!room) {
    return (
      <div className="screen">
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Connecting to room…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className={`panel ${styles.roomPage}`}>
        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => { leaveRoom(roomId); navigate('/') }}>
            ✕ Leave
          </button>
          <span className={`badge badge-juice`}>{mode === 'GTN' ? 'Guess The Number' : 'Bulls & Cows'}</span>
          <span className={`badge ${room.isPublic ? 'badge-juice' : 'badge-pink'}`}>
            {room.isPublic ? 'Public' : room.code}
          </span>
        </div>

        {/* Room code sharing */}
        {phase === 'LOBBY' && (
          <RoomCodeBox code={room.code} />
        )}

        {/* Players */}
        <div className={styles.players}>
          <PlayerSlot player={me} isYou label="You" />
          <span className={styles.vs}>vs</span>
          {opponent ? (
            <PlayerSlot player={opponent} label={opponent.name} />
          ) : (
            <div className={styles.waitingSlot}>
              <div className={styles.spinner} />
              <span>Waiting…</span>
            </div>
          )}
        </div>

        {/* Skull + roast */}
        <div className={styles.skullRow}>
          <SkullMascot expression={expression} size={80} />
          {state.roast && (
            <p className={`${styles.roast} anim-slide-up`} key={state.roast}>"{state.roast}"</p>
          )}
        </div>

        {/* SETUP phase — ready up */}
        {phase === 'SETUP' && !me?.ready && (
          <form className={styles.setupForm} onSubmit={handleReady}>
            {mode === 'BC' && (
              <>
                <p className={styles.setupHint}>Set a 4-digit secret code for your opponent to crack.</p>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 3719"
                  value={secret}
                  onChange={e => { setSecret(e.target.value); setSecretError('') }}
                  aria-label="Your secret code"
                />
                {secretError && <p className={styles.fieldError}>{secretError}</p>}
              </>
            )}
            {mode === 'GTN' && (
              <>
                <p className={styles.setupHint}>
                  Pick a secret number (1–100). Your opponent will try to guess it.
                  They won't see it until the game ends.
                </p>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  placeholder="e.g. 42"
                  value={secret}
                  onChange={e => { setSecret(e.target.value); setSecretError('') }}
                  aria-label="Your secret number"
                  autoFocus
                />
                {secretError && <p className={styles.fieldError}>{secretError}</p>}
              </>
            )}
            <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }}>
              Ready!
            </button>
          </form>
        )}

        {phase === 'SETUP' && me?.ready && !opponent?.ready && (
          <p className={styles.waitingText}>Waiting for {opponent?.name || 'opponent'} to get ready…</p>
        )}

        {/* PLAYING phase */}
        {phase === 'PLAYING' && (
          <>
            <TurnTimer active={isMyTurn} seconds={state.turnTimeLeft} />

            {/* ── Your secret (always visible) ── */}
            {(mySecretRef.current || state.room?.mySecret) && (
              <div className={styles.mySecretBanner}>
                <div className={styles.mySecretTop}>
                  <span className={styles.mySecretLabel}>🔒 Your secret {mode === 'GTN' ? 'number' : 'code'}</span>
                  <span className={styles.mySecretValue}>
                    {mySecretRef.current || state.room?.mySecret}
                  </span>
                </div>
                <span className={styles.mySecretHint}>
                  👆 {opponent?.name || 'Opponent'} is trying to guess this — don't reveal it!
                </span>
              </div>
            )}

            {/* ── B&C legend ── */}
            {mode === 'BC' && (
              <div className={styles.bcLegend}>
                <div className={styles.bcLegendItem}>
                  <span className={styles.bcIcon}>🐂</span>
                  <div>
                    <strong>Bull</strong>
                    <span> — right digit, right position</span>
                  </div>
                </div>
                <div className={styles.bcLegendItem}>
                  <span className={styles.bcIcon}>🐄</span>
                  <div>
                    <strong>Cow</strong>
                    <span> — right digit, wrong position</span>
                  </div>
                </div>
              </div>
            )}

            {isMyTurn ? (
              <form className={styles.guessForm} onSubmit={handleGuess}>
                <p className={styles.yourTurn}>Your turn!</p>
                <input
                  ref={inputRef}
                  className="input"
                  type={mode === 'GTN' ? 'number' : 'text'}
                  inputMode="numeric"
                  maxLength={mode === 'BC' ? 4 : 3}
                  placeholder={mode === 'GTN' ? '1 – 100' : '4 unique digits'}
                  value={guess}
                  onChange={e => { setGuess(e.target.value); setGuessError('') }}
                  aria-label="Your guess"
                />
                {guessError && <p className={styles.fieldError}>{guessError}</p>}
                <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }}>
                  Guess
                </button>
              </form>
            ) : (
              <p className={styles.waitingText}>
                {opponent?.name || 'Opponent'} is guessing…
              </p>
            )}

            <GuessList guesses={state.guesses.filter(g => g.guesser === playerId)} mode={mode} />
          </>
        )}

        {/* GAME OVER */}
        {phase === 'GAME_OVER' && (
          <>
            <GameOverCard
              won={state.won}
              attempts={state.guesses.filter(g => g.guesser === playerId).length}
              mode={mode}
              scores={room?.players}
              multiplayer
              onPlayAgain={null}   /* handled by RematchPrompt below */
              onHome={() => { leaveRoom(roomId); navigate('/') }}
            />

            {/* Rematch prompt — 4 states */}
            <RematchPrompt
              rematchStatus={state.rematchStatus}
              requesterName={state.rematchRequesterName}
              myName={me?.name}
              onPlayAgain={() => requestRematch(roomId)}
              onAccept={() => acceptRematch(roomId)}
              onDecline={() => { declineRematch(roomId); navigate('/') }}
              onHome={() => { leaveRoom(roomId); navigate('/') }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function PlayerSlot({ player, isYou, label }) {
  return (
    <div className={`${styles.playerSlot} ${player?.ready ? styles.ready : ''}`}>
      <span className={styles.playerName}>{label}</span>
      <span className={styles.playerScore}>{player?.score ?? 0}</span>
      {player?.ready && <span className={`badge badge-juice`}>Ready</span>}
    </div>
  )
}

/* ── Room code box with copy button ─────────────────────────────── */
import { useState as useLocalState } from 'react'

function RoomCodeBox({ code }) {
  const [copied, setCopied] = useLocalState(false)

  function handleCopy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.codeBox}>
      <p className={styles.codeLabel}>Room Code</p>
      <div className={styles.codeRow}>
        <span className={styles.codeValue}>{code}</span>
        <button
          className={styles.copyBtn}
          onClick={handleCopy}
          title="Copy room code"
          aria-label="Copy room code"
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>
      <p className={styles.codeHint}>
        {copied ? '✓ Copied to clipboard!' : 'Share this code with a friend to invite them'}
      </p>
    </div>
  )
}
