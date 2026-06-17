import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import { recordGameForBadges } from '../services/badges.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameLogo from '../components/GameLogo.jsx'
import GuessList from '../components/game/GuessList.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import RematchPrompt from '../components/game/RematchPrompt.jsx'
import TurnTimer from '../components/game/TurnTimer.jsx'
import EmojiBurst from '../components/game/EmojiBurst.jsx'
import ChatPanel from '../components/game/ChatPanel.jsx'
import RoomActionDock from '../components/game/RoomActionDock.jsx'
import RoomSocialCluster from '../components/game/RoomSocialCluster.jsx'
import RoomToasts from '../components/game/RoomToasts.jsx'
import MultiplayerTutorial from '../components/tutorial/MultiplayerTutorial.jsx'
import ConfirmDialog from '../components/common/ConfirmDialog.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { useDelayedFlag } from '../hooks/useDelayedFlag.js'
import { useAwayTimeout } from '../hooks/useAwayTimeout.js'
import { useLeaveOnExit } from '../hooks/useLeaveOnExit.js'
import MatchRoom from '../components/match/MatchRoom.jsx'
import Loader from '../components/Loader.jsx'
import styles from './RoomPage.module.css'

const QUICK_EMOJIS = ['😂', '😈', '🔥', '💀', '🤡', '👑', '😭', '🧠']

// New game modes (XOX / Math Battle / Sudoku / Spin Battle) use a separate
// real-time match flow rendered by MatchRoom; the GTN/BC guess flow is untouched.
const MATCH_MODES = new Set(['XOX', 'MATH', 'SUDOKU', 'SPIN', 'SOS', 'RMCS', 'RUMMY', 'QUEENS', 'TANGO'])

// Thin router: decides which room UI to render based on the room's mode.
// If we landed cold (refresh / direct link) we reconnect first to learn the
// mode, then delegate. The child components run their own full reconnect.
export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { state, reconnectRoom, leaveRoom, clearRoom } = useRoom()
  const { socket } = useSocket()
  const room = state.room
  const mode = room?.mode

  // Route-level cleanup, so it survives the inner loading↔board churn (and dev
  // StrictMode), only running on a REAL navigation away from /room/:id:
  //  • clear local room state (so the lobby's auto-navigate can't bounce us back); and
  //  • tell the server we left (deferred + cancel-on-remount; skipped on reload,
  //    where the socket drops and the reconnect grace covers it).
  useEffect(() => () => clearRoom(), []) // eslint-disable-line react-hooks/exhaustive-deps
  useLeaveOnExit(roomId, leaveRoom, () => !!socket?.connected)

  // Learn the room's mode by (re)connecting. Self-healing: this re-runs whenever
  // we're mounted on the room route WITHOUT a room — on first entry, after a
  // refresh, or if local state was momentarily cleared — and also on every socket
  // (re)connect. We only leave for home when the room is genuinely gone.
  useEffect(() => {
    if (!socket || !roomId || room) return
    let cancelled = false
    const attempt = async () => {
      if (cancelled) return
      const r = await reconnectRoom(roomId)
      if (cancelled) return
      if (r?.gone) navigate('/home')   // room truly over → leave; else keep retrying
    }
    attempt()
    socket.on('connect', attempt)
    return () => { cancelled = true; socket.off('connect', attempt) }
  }, [socket, roomId, room]) // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net: a genuinely-missing room resolves fast (reconnect → gone → /home).
  // But if the SERVER is unreachable, the reconnect ack just times out and retries
  // forever — an endless "Connecting…" spinner. After ~15s, offer an escape hatch.
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (room) { setStuck(false); return }
    if (stuck) return
    const t = setTimeout(() => setStuck(true), 15_000)
    return () => clearTimeout(t)
  }, [room, stuck])

  async function retryRoom() {
    setStuck(false)               // re-arms the timeout + flips back to the spinner
    const r = await reconnectRoom(roomId)
    if (r?.gone) navigate('/home')
  }

  if (!room) {
    return (
      <div className="screen">
        <div className={styles.loading}>
          {stuck ? (
            <>
              <p style={{ fontWeight: 700 }}>😕 Couldn't reach the room</p>
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
                It may have ended, or your connection dropped.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', marginTop: 'var(--space-2, 8px)' }}>
                <button className="btn btn-juice" onClick={retryRoom}>Retry</button>
                <button className="btn btn-ghost" onClick={() => navigate('/home')}>Home</button>
              </div>
            </>
          ) : (
            <Loader label="Connecting to room…" />
          )}
        </div>
      </div>
    )
  }
  if (MATCH_MODES.has(mode)) return <MatchRoom roomId={roomId} mode={mode} />
  return <GuessRoom />
}

function GuessRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const {
    state, setReady, submitGuess, requestRematch, acceptRematch, declineRematch, leaveRoom, clearRoom,
    sendChat, sendEmoji, clearUnreadChat, reconnectRoom,
  } = useRoom()
  const { playerId } = usePlayer()
  const [chatOpen, setChatOpen] = useState(false)
  const { socket, connected } = useSocket()
  const { isRegistered, updateUser } = useAuth()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [secret, setSecret] = useState('')
  const [guess, setGuess] = useState('')
  const [secretError, setSecretError] = useState('')
  const [guessError, setGuessError] = useState('')
  // Ignore a brief opponent drop (e.g. a page refresh) — only alarm after ~2.5s.
  const showOppLost = useDelayedFlag(connected && state.opponentConnLost, 2500)
  const inputRef = useRef(null)
  // Keep the secret visible during gameplay after Ready is clicked
  const mySecretRef = useRef('')
  const recordedRef = useRef(false)  // record each multiplayer game once

  const room = state.room
  const mode = room?.mode || 'GTN'
  const phase = room?.phase || 'IDLE'
  const me = room?.players?.find(p => p.id === playerId)
  const opponent = room?.players?.find(p => p.id !== playerId)
  const isMyTurn = state.myTurn

  // Premium action dock (emoji · chat · call · help · music). GTN/B&C are always
  // 1v1, so voice is available whenever an opponent is present.
  const [callActive, setCallActive] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)   // premium "leave the game?" guard
  const showCall = !!opponent
  useEffect(() => { if (!showCall) setCallActive(false) }, [showCall])
  // Reserve bottom space so the dock / call bar never cover the board or result
  // buttons; the dock tucks away at game over (only clear a lingering call pill).
  const dockPad = phase === 'GAME_OVER'
    ? (callActive ? '72px' : 'var(--space-8, 32px)')
    : (callActive ? '156px' : '100px')

  // ── Opponent's guesses (broadcast to room) ───────────────────────────────
  const opponentGuesses = state.guesses.filter(g => g.guesser !== playerId)
  const opponentLastGuess = opponentGuesses[opponentGuesses.length - 1] || null

  // Feature 2 (B&C): which positions of MY secret has the opponent guessed
  // as a BULL (exact position). Accumulates — stays red once found.
  const foundPositions = new Set()
  if (mode === 'BC') {
    for (const g of opponentGuesses) {
      const pos = g.result?.positions || []
      pos.forEach((p, i) => { if (p === 'bull') foundPositions.add(i) })
    }
  }

  const mySecret = mySecretRef.current || state.room?.mySecret || ''

  // Track that we actually entered a room, so a stale-flag can't fire on mount
  const enteredRoomRef = useRef(false)
  useEffect(() => { if (room) enteredRoomRef.current = true }, [room])

  // (Clearing room state + telling the server we left are handled once at the
  // RoomPage route level so the inner StrictMode/loading churn can't trip them.)

  // Away too long (locked/backgrounded past the reconnect grace) → the room is
  // dead; go to the game list instead of a stale board. Skip once the game's over.
  useAwayTimeout(!!room && phase !== 'GAME_OVER', () => { leaveRoom(roomId); navigate('/home') })

  // Reconnect + restore on mount AND on every socket (re)connect.
  // Covers: page refresh, network drop, network switch, app resume.
  useEffect(() => {
    if (!socket || !roomId) return

    const doReconnect = async () => {
      const r = await reconnectRoom(roomId)
      if (r?.gone) { navigate('/home'); return }   // only leave if the room is truly over
      // Restore my secret so the secret banner shows after a refresh
      if (r?.snapshot?.mySecret) mySecretRef.current = r.snapshot.mySecret
    }

    doReconnect()
    socket.on('connect', doReconnect)  // fires again on every reconnection
    return () => socket.off('connect', doReconnect)
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnected while the opponent was mid-grace: leave for the lobby at the
  // close deadline even if the server's opponent_left event is missed.
  useEffect(() => {
    if (!state.opponentCloseAt) return
    const t = setTimeout(() => { leaveRoom(roomId); navigate('/home') },
      Math.max(0, state.opponentCloseAt - Date.now()) + 1500)
    return () => clearTimeout(t)
  }, [state.opponentCloseAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Room closed (opponent left / declined) → show message briefly, then go home.
  // Uses enteredRoomRef instead of `room` so it still fires after room is cleared.
  useEffect(() => {
    if (state.roomClosedByOpponent && enteredRoomRef.current) {
      const delay = state.opponentLeftMessage ? 1800 : 0
      const t = setTimeout(() => navigate('/home'), delay)
      return () => clearTimeout(t)
    }
  }, [state.roomClosedByOpponent, state.opponentLeftMessage, navigate])

  // When my rematch request was declined → show message, then home
  useEffect(() => {
    if (state.rematchStatus === 'declined') {
      const t = setTimeout(() => { leaveRoom(roomId); navigate('/home') }, 2200)
      return () => clearTimeout(t)
    }
  }, [state.rematchStatus, navigate, leaveRoom, roomId])

  // NOTE: we intentionally do NOT auto-focus the guess input on turn change.
  // Doing so popped the mobile number keyboard the instant the opponent guessed
  // (turn passes to you) — covering the Guess History. The player taps the field
  // when they're ready to type instead.

  // ── Sound + haptics on each guess result ──────────────────────────────────
  useEffect(() => {
    const r = state.lastGuessResult
    if (!r) return
    if (r.correct || r.won) { playWin(); buzz('correct') }
    else { playTone(r.proximity ?? (r.bulls ? r.bulls / 6 : 0)); buzz('wrong') }
  }, [state.lastGuessResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // Win / lose chord when the round ends
  useEffect(() => {
    if (phase === 'GAME_OVER') {
      if (state.won) playWin()
      else if (state.won === false) playLose()
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the "you're offline" banner so it doesn't flash on the initial
  // connect or a sub-second blip.
  const [showOffline, setShowOffline] = useState(false)
  useEffect(() => {
    if (connected) { setShowOffline(false); return }
    const t = setTimeout(() => setShowOffline(true), 1200)
    return () => clearTimeout(t)
  }, [connected])

  // Record the result ONLY on the real PLAYING → GAME_OVER transition.
  // (Reconnecting straight into GAME_OVER must NOT re-record — prevents
  //  double-counting stats after a refresh.)
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (phase === 'PLAYING') recordedRef.current = false  // new game → allow next record
    // Best-of-3: only record when the whole match is decided, not each round.
    if (prev === 'PLAYING' && phase === 'GAME_OVER' && !recordedRef.current && state.matchOver !== false) {
      recordedRef.current = true
      const won = !!state.won
      recordGameForBadges({ mode, won, multiplayer: true, gtnRange1000Win: mode === 'GTN' && won })
      if (isRegistered) {
        api.post('/game/record', { mode, won })
          .then(d => { if (d.user) updateUser(d.user) })
          .catch(() => {})
      }
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReady(e) {
    e.preventDefault()
    if (mode === 'GTN') {
      const n = parseInt(secret, 10)
      if (!secret || isNaN(n) || n < 1 || n > 1000) {
        setSecretError('Enter a number between 1 and 1000')
        return
      }
    }
    if (mode === 'BC') {
      const s = secret.trim()
      if (!/^\d{6}$/.test(s)) {
        setSecretError('Enter a 6-digit code (0-9, repeats allowed)')
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
      if (isNaN(n) || n < 1 || n > 1000) { setGuessError('Enter 1–1000'); return }
    } else {
      if (!/^\d{6}$/.test(val)) { setGuessError('Enter 6 digits'); return }
    }
    setGuessError('')
    setGuess('')
    submitGuess(roomId, mode === 'GTN' ? parseInt(val, 10) : val)
  }

  function openChat() {
    setChatOpen(true)
    clearUnreadChat()
  }

  if (!room) {
    return (
      <div className="screen">
        <div className={styles.loading}>
          <Loader label="Connecting to room…" />
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <MultiplayerTutorial variant="guess" />
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
      {/* You are offline (your own socket dropped) — debounced */}
      {showOffline && (
        <div className={`${styles.connBanner} ${styles.connOffline}`}>
          📡 You’re offline — reconnecting…
        </div>
      )}
      {/* Opponent dropped (within grace) — debounced so a quick refresh is silent */}
      {showOppLost && (
        <div className={`${styles.connBanner} ${styles.connOppLost}`}>
          ⚠️ {opponent?.name || 'Opponent'} lost connection — waiting for them to return…
        </div>
      )}

      <div className={`panel ${styles.roomPage}`} style={{ paddingBottom: dockPad }}>
        {/* Header */}
        <div className={styles.header}>
          <button className={`${styles.hChip} ${styles.hLeave}`} onClick={() => setConfirmLeave(true)}>
            ✕ Leave
          </button>
          <span className={`${styles.hChip} ${styles.hMode}`}>{mode === 'GTN' ? 'Guess The Number' : 'Bulls & Cows'}</span>
          <span className={`${styles.hChip} ${room.isPublic ? styles.hPublic : styles.hCode}`}>
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
          {/* Call now lives in the action dock; the cluster keeps add-friend only. */}
          <RoomSocialCluster roomId={roomId} opponent={opponent} allowVoice={false} />
          {opponent ? (
            <PlayerSlot player={opponent} label={opponent.name} />
          ) : (
            <div className={styles.waitingSlot}>
              <div className={styles.spinner} />
              <span>Waiting…</span>
            </div>
          )}
        </div>

        {/* Roast line (kept) — the redundant mid-screen skull was removed for a
            cleaner board, matching the other game modes. */}
        {state.roast && (
          <p className={`${styles.roast} anim-slide-up`} key={state.roast} style={{ textAlign: 'center' }}>"{state.roast}"</p>
        )}

        {/* SETUP phase — ready up */}
        {phase === 'SETUP' && !me?.ready && (
          <form className={styles.setupForm} onSubmit={handleReady}>
            {mode === 'BC' && (
              <>
                <p className={styles.setupHint}>Set a 6-digit secret code (repeats allowed) for your opponent to crack.</p>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 371928"
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
                  Pick a secret number (1–1000). Your opponent will try to guess it.
                  They won't see it until the game ends.
                </p>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  placeholder="e.g. 427"
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
            {mySecret && (
              <div className={styles.mySecretBanner}>
                <div className={styles.mySecretTop}>
                  <span className={styles.mySecretLabel}>🔒 Your secret {mode === 'GTN' ? 'number' : 'code'}</span>
                  {mode === 'BC' ? (
                    <span className={styles.mySecretDigits}>
                      {mySecret.split('').map((d, i) => (
                        <span
                          key={i}
                          className={`${styles.secretDigit} ${foundPositions.has(i) ? styles.secretDigitFound : ''}`}
                        >
                          {d}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={styles.mySecretValue}>{mySecret}</span>
                  )}
                </div>
                <span className={styles.mySecretHint}>
                  {mode === 'BC' && foundPositions.size > 0
                    ? `⚠️ ${opponent?.name || 'Opponent'} has locked ${foundPositions.size} of your digits (red)!`
                    : `👆 ${opponent?.name || 'Opponent'} is trying to guess this — don't reveal it!`}
                </span>
              </div>
            )}

            {/* ── Feature 1: opponent's latest guess ── */}
            {opponentLastGuess && (
              <div className={styles.oppGuessBox}>
                <span className={styles.oppGuessLabel}>
                  {opponent?.name || 'Opponent'}'s last guess
                </span>
                <span className={styles.oppGuessValue}>
                  {opponentLastGuess.guess}
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
                    <span> — right digit, right position (highlighted)</span>
                  </div>
                </div>
                <div className={styles.bcLegendItem}>
                  <span className={styles.bcIcon}>🐄</span>
                  <div>
                    <strong>Cow</strong>
                    <span> — a digit is in the code but in the wrong spot</span>
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
                  maxLength={mode === 'BC' ? 6 : 4}
                  placeholder={mode === 'GTN' ? '1 – 1000' : '6 digits'}
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
          state.matchOver === false ? (
            /* ── Best-of-3: a round ended but the series continues ── */
            <div className={styles.roundOver}>
              <SkullMascot expression={state.won ? 'impressed' : 'annoyed'} size={84} glow={state.won} />
              <h2 key={state.won ? 'w' : 'l'} className="anim-msg" style={{ margin: '6px 0 0' }}>
                {state.won ? '🎉 You won the round!' : 'Round lost'}
              </h2>
              <p className={styles.seriesScore}>
                Series — <b>You {me?.score || 0}</b> · <b>{opponent ? (opponent.score || 0) : 0} {opponent?.name || 'Opp'}</b> · best of 3
              </p>
              {opponent && state.revealedSecrets?.[opponent.id] && (
                <p style={{ textAlign: 'center', margin: 0, color: 'var(--color-text-secondary)' }}>
                  {opponent.name || 'Opponent'}'s {mode === 'GTN' ? 'number' : 'code'} was{' '}
                  <b style={{ color: 'var(--color-juice)', letterSpacing: '0.1em' }}>{state.revealedSecrets[opponent.id]}</b>
                </p>
              )}
              <p className={styles.waitingText}>Next round starting…</p>
            </div>
          ) : (
          <>
            <GameOverCard
              won={state.won}
              attempts={state.guesses.filter(g => g.guesser === playerId).length}
              mode={mode}
              scores={room?.players}
              multiplayer
              onPlayAgain={null}   /* handled by RematchPrompt below */
              onHome={() => { leaveRoom(roomId); navigate('/home') }}
            />

            {/* Series result (best of 3) */}
            {opponent && (
              <p className={styles.seriesScore}>
                Match — <b>You {me?.score || 0}</b> · <b>{opponent.score || 0} {opponent.name || 'Opp'}</b>
              </p>
            )}

            {/* Reveal the opponent's secret — so the loser learns what they
                couldn't crack (shown to both players). */}
            {opponent && state.revealedSecrets?.[opponent.id] && (
              <p
                className="anim-msg"
                style={{ textAlign: 'center', margin: '6px 0 0', color: 'var(--color-text-secondary)' }}
              >
                {opponent.name || 'Opponent'}'s {mode === 'GTN' ? 'number' : 'code'} was{' '}
                <b style={{ color: 'var(--color-juice)', letterSpacing: '0.1em', fontSize: '1.1em' }}>
                  {state.revealedSecrets[opponent.id]}
                </b>
              </p>
            )}

            {/* Rematch prompt — 4 states */}
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

      {/* ── Opponent-left overlay ── */}
      {state.opponentLeftMessage && (
        <div className={styles.leftOverlay} role="alert">
          <div className={`${styles.leftCard} anim-bounce-land`}>
            <GameLogo variant="static" size={72} />
            <h2 className={styles.leftTitle}>{state.opponentLeftMessage}</h2>
            <p className={styles.leftSub}>Taking you back home…</p>
          </div>
        </div>
      )}

      {/* ── Emoji burst overlay (full screen) ── */}
      <EmojiBurst trigger={state.lastEmoji} />

      {/* ── Premium action dock — emoji · chat · call · help · music ── */}
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
        onEmoji={(e) => sendEmoji(roomId, e)}
        onOpenChat={openChat}
      />

      <RoomToasts roomId={roomId} />

      {/* ── Chat panel (bottom sheet) ── */}
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
