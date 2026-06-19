import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { useSocket } from './SocketContext.jsx'
import { usePlayer } from './PlayerContext.jsx'

const RoomContext = createContext(null)

// Emit with an ack TIMEOUT so a slow/dropped connection can't hang the UI
// forever — resolves with a friendly error instead of waiting indefinitely.
function emitAck(socket, ev, data, ms = 8000) {
  return new Promise(res => {
    if (!socket) return res({ ok: false, error: 'Not connected — check your internet' })
    try {
      socket.timeout(ms).emit(ev, data, (err, response) => {
        if (err) return res({ ok: false, error: 'Connection is slow — please try again', timeout: true })
        res(response || { ok: false })
      })
    } catch {
      res({ ok: false, error: 'Could not reach the server — please try again' })
    }
  })
}

const INITIAL = {
  room:                 null,
  phase:                'IDLE',
  guesses:              [],
  isSpectator:          false,   // true while watching someone else's game
  myTurn:               false,
  turnTimeLeft:         30,
  turnTimeTotal:        30,   // full per-turn duration (server-driven; for the bar)
  lastGuessResult:      null,
  roast:                null,
  error:                null,
  matchmaking:          false,
  matchmakingTimedOut:  false,
  won:                  null,
  winnerId:             null,
  draw:                 false,
  // New game modes (XOX / Math Battle / Sudoku) — generic real-time match state
  match:                null,
  // Spin Battle: last wheel/guess event (drives the wheel animation + feedback)
  spin:                 null,
  // XOX best-of-3: transient round-over banner (between games of the series)
  xoxRound:             null,
  sosLastCell:          null,   // SOS: last placed cell (board highlight)
  sosTimeout:           null,   // SOS: transient timeout event (premium centre flash)
  seriesScore:          null,   // final series tally shown at match over
  // Rematch state machine: idle | requesting | incoming | declined
  rematchStatus:        'idle',
  rematchRequesterName: null,  // name of who sent the request
  roomClosedByOpponent: false,
  // Chat + emoji
  chatMessages:         [],    // { id, fromPlayerId, fromName, text, ts, mine }
  unreadChat:          0,
  lastEmoji:            null,  // { id, emoji, mine } — drives the burst overlay
  lastIncomingChat:     null,  // newest opponent message → floating toast bubble
  // Friend requests (registered players)
  incomingFriend:       null,  // { fromName, fromPlayerId, fromUserId } — someone asked to be friends
  friendStatus:         'idle',// idle | requested | friends
  friendPresence:       null,  // { name, online, ts } — transient "friend came online" signal
  friendAccepted:       null,  // { name, ts } — transient "X accepted your request" signal
  // Opponent left / room closed — drives redirect + message
  opponentLeftMessage:  null,
  // Opponent temporarily dropped (within grace) — drives "reconnecting…" banner
  opponentConnLost:     false,
  // When the room will auto-close because the opponent is mid-grace (set on a
  // reconnect that lands while they're gone) — lets us leave on time, not late.
  opponentCloseAt:      null,
}

// Math Battle scores arrive as [{ id, score }]; we store them as a map keyed
// by playerId. Falls back to the existing map if no array is provided.
function arrToScoreMap(arr, fallback) {
  if (!Array.isArray(arr)) return fallback || {}
  const m = {}
  for (const s of arr) m[s.id] = s.score
  return m
}

function reducer(state, action) {
  switch (action.type) {

    case 'ROOM_UPDATED': {
      const newPhase = action.room?.phase || 'IDLE'
      const rematchReset = newPhase === 'SETUP' ? {
        rematchStatus: 'idle', rematchRequesterName: null,
        won: null, winnerId: null, draw: false, match: null,
        guesses: [], lastGuessResult: null, roast: null,
        matchOver: false, revealedSecrets: null,   // clear last round's result for the next one
      } : {}
      return {
        ...state,
        ...rematchReset,
        room:                 action.room,
        phase:                newPhase,
        error:                null,
        // We've been placed in a room → stop "searching". This makes the reliable
        // room-level room:updated a fallback if the direct room:quickmatch_found was
        // missed (socket race) — otherwise the matched player searched until timeout.
        matchmaking:          false,
        roomClosedByOpponent: false,          // always clear stale flag on new room
        rematchStatus:        rematchReset.rematchStatus ?? 'idle',  // always reset
        rematchRequesterName: rematchReset.rematchRequesterName ?? null,
      }
    }

    case 'GAME_START':
      return {
        ...state,
        room:                action.room,
        phase:               'PLAYING',
        guesses:             [],
        lastGuessResult:     null,
        roast:               null,
        won:                 null,
        winnerId:            null,
        rematchStatus:        'idle',
        rematchRequesterName: null,
        roomClosedByOpponent: false,
        myTurn:              action.room.turnId === action.playerId,
      }

    case 'GUESS_RESULT': {
      const isGameOver = action.result?.correct || action.result?.over
      return {
        ...state,
        guesses:         [...state.guesses, action.entry],
        lastGuessResult: action.result,
        roast:           action.roast,
        // Only update myTurn if the game isn't over — prevents "opponent is guessing" flash
        myTurn: isGameOver ? false : (action.nextTurnId === action.playerId),
      }
    }

    case 'TURN_CHANGE': {
      const secs = action.timerMs ? Math.round(action.timerMs / 1000) : 30
      return { ...state, myTurn: action.playerId === action.myId, turnTimeLeft: secs, turnTimeTotal: secs }
    }

    case 'TIMER_TICK':
      return { ...state, turnTimeLeft: Math.max(0, state.turnTimeLeft - 1) }

    case 'ROUND_OVER': {
      // Update BOTH state.phase AND state.room.phase so RoomPage sees the change
      const updatedRoom = state.room
        ? {
            ...state.room,
            phase: 'GAME_OVER',
            // Update scores if provided
            players: action.scores
              ? state.room.players.map(p => ({
                  ...p,
                  score: action.scores.find(s => s.id === p.id)?.score ?? p.score,
                }))
              : state.room.players,
          }
        : state.room

      return {
        ...state,
        phase:    'GAME_OVER',
        room:     updatedRoom,
        myTurn:   false,
        won:      action.winnerId ? action.winnerId === action.playerId : null,
        winnerId: action.winnerId || null,
        matchOver: action.matchOver !== false,   // false = best-of-3 round (series continues)
        revealedSecrets: action.secrets || null,   // { playerId: secret } — shown at game over
      }
    }

    // ── New game modes (XOX / Math / Sudoku) ───────────────────────────────
    // Match started — server sends { room (summary), match (public state) }
    case 'XOX_ROUNDOVER': {
      const p = action.payload || {}
      return {
        ...state,
        match: state.match ? { ...state.match, board: p.board ?? state.match.board, series: p.series ?? state.match.series } : state.match,
        xoxRound: { winnerId: p.winnerId || null, draw: !!p.draw, matchOver: !!p.matchOver, gameNo: p.gameNo, series: p.series || null },
      }
    }

    case 'MATCH_START':
      return {
        ...state,
        room:  action.room ? { ...state.room, ...action.room } : state.room,
        phase: 'PLAYING',
        match: action.match,
        spin:  action.match?.kind === 'SPIN' && action.match.turnCountdownMs
          ? { turnEndsAt: Date.now() + action.match.turnCountdownMs }
          : null,
        xoxRound: null,
        sosLastCell: null,
        won: null, winnerId: null, draw: false,
        rematchStatus: 'idle', rematchRequesterName: null,
        roomClosedByOpponent: false,
        myTurn: action.match?.turnId === action.playerId,
      }

    // Generic match state update (e.g. XOX board changed)
    case 'MATCH_STATE':
      return {
        ...state,
        match: { ...state.match, ...action.patch },
        myTurn: action.patch?.turnId !== undefined
          ? action.patch.turnId === action.playerId
          : state.myTurn,
      }

    // SOS: full match snapshot after a placement / claim / timeout.
    case 'SOS_UPDATE':
      return {
        ...state,
        match: action.match ? { ...state.match, ...action.match } : state.match,
        myTurn: action.match?.turnId !== undefined
          ? action.match.turnId === action.playerId
          : state.myTurn,
        sosLastCell: action.lastCell !== undefined ? action.lastCell : state.sosLastCell,
        // Transient: a turn timed out. Drives the premium centre-screen flash.
        sosTimeout: action.timedOut
          ? { by: action.by, bonusTo: action.bonusTo || null, amount: action.bonusAmount || 0, ts: Date.now() }
          : state.sosTimeout,
      }

    // RMCS: public match patch (reveal progress / stage moves / round result).
    // Merging preserves my private `myRole` (the patch never carries it).
    case 'RMCS_UPDATE':
      return {
        ...state,
        match: action.match ? { ...state.match, ...action.match } : state.match,
      }

    // RUMMY: draw / discard / timeout. The public patch omits `myHand`, so merging
    // preserves the hand last sent privately via _matchView; a personal patch
    // (after my own draw/discard) carries the fresh `myHand`.
    case 'RUMMY_UPDATE':
      return {
        ...state,
        match: action.match ? { ...state.match, ...action.match } : state.match,
        myTurn: action.match?.turnId !== undefined
          ? action.match.turnId === action.playerId
          : state.myTurn,
      }

    // RUMMY: someone declared — stash the reveal (winner's groups / why invalid).
    case 'RUMMY_DECLARED':
      return { ...state, rummyReveal: action.payload || null }

    // Puzzle race (Queens/Tango): a player placed/marked a cell. My own patch carries
    // `myBoard`; an opponent's patch is the public view (progress only, no board) —
    // merging preserves my last `myBoard`, exactly like RUMMY_UPDATE.
    case 'RACE_UPDATE':
      return {
        ...state,
        match: action.match ? { ...state.match, ...action.match } : state.match,
      }

    // RMCS: the host dealt a fresh round — per-viewer payload REPLACES the match
    // (it carries my new private role; the old round's must not linger).
    case 'RMCS_ROUND':
      return {
        ...state,
        match: action.match || state.match,
      }

    // Spin Battle: an action happened (spin / guess / vowel / solve / roundover).
    case 'SPIN_EVENT': {
      const p = action.payload || {}
      const match = p.match ? { ...state.match, ...p.match } : state.match
      const turnId = p.match?.turnId ?? state.match?.turnId
      const prevNonce = state.spin?.nonce || 0
      return {
        ...state,
        match,
        myTurn: turnId === action.playerId,
        spin: {
          // Only bump the nonce on an actual spin → re-triggers the wheel.
          nonce: p.event === 'spin' ? prevNonce + 1 : prevNonce,
          event: p.event, by: p.by,
          index: p.index ?? state.spin?.index ?? 0,
          wedge: p.wedge, effect: p.effect, stealAmount: p.stealAmount,
          letter: p.letter, correct: p.correct, count: p.count, points: p.points,
          passed: p.passed, solved: p.solved, skipped: p.skipped,
          winnerId: p.winnerId, matchOver: p.matchOver,
          // Round-over: revealed answer + a local deadline for the synced countdown.
          answer: p.event === 'roundover' ? p.answer : state.spin?.answer,
          roundEndsAt: p.event === 'roundover' && p.countdownMs ? Date.now() + p.countdownMs : null,
          turnEndsAt: state.spin?.turnEndsAt,   // carried; re-set by spin:turn
          ts: Date.now(),
        },
      }
    }

    // Spin Battle: the active player's turn timer was (re)armed → visible countdown.
    case 'SPIN_TURN': {
      return {
        ...state,
        spin: { ...(state.spin || {}), turnEndsAt: action.turnCountdownMs ? Date.now() + action.turnCountdownMs : null },
      }
    }

    // Spin Battle: my own wrong consonant (private — only I receive this).
    case 'SPIN_WRONG': {
      if (!state.match) return state
      const cur = state.match.myWrongLetters || []
      if (cur.includes(action.letter)) return state
      return { ...state, match: { ...state.match, myWrongLetters: [...cur, action.letter] } }
    }

    // Spin Battle: a fresh round started.
    case 'SPIN_ROUND': {
      const p = action.payload || {}
      const match = p.match ? { ...state.match, ...p.match, myWrongLetters: [] } : state.match
      return {
        ...state,
        match,
        myTurn: match?.turnId === action.playerId,
        spin: { ...(state.spin || {}), event: 'newround', round: p.round, answer: null, roundEndsAt: null, turnEndsAt: null, ts: Date.now() },
      }
    }

    case 'MATCH_OVER': {
      const updatedRoom = state.room
        ? {
            ...state.room,
            phase: 'GAME_OVER',
            players: action.scores
              ? state.room.players.map(p => ({
                  ...p,
                  score: action.scores.find(s => s.id === p.id)?.score ?? p.score,
                }))
              : state.room.players,
          }
        : state.room
      return {
        ...state,
        phase:    'GAME_OVER',
        room:     updatedRoom,
        myTurn:   false,
        draw:     !!action.draw,
        won:      action.draw ? null : (action.winnerId ? action.winnerId === action.playerId : null),
        winnerId: action.winnerId || null,
        ranking:  action.ranking || null,
        overReason: action.reason || null,
        seriesScore: action.series || null,
        xoxRound: null,
      }
    }

    // Math Battle: a new question is served to both players
    case 'MATH_QUESTION': {
      const p = action.payload
      return {
        ...state,
        match: {
          ...(state.match || {}),
          kind:     'MATH',
          index:    p.index,
          total:    p.total,
          question: { index: p.index, prompt: p.prompt, options: p.options, total: p.total },
          scores:   arrToScoreMap(p.scores, state.match?.scores),
          resolved: false,
          lastResolved: null,
        },
      }
    }

    // Math Battle: the current question was answered (or timed out) and locked
    case 'MATH_RESOLVED': {
      const p = action.payload
      return {
        ...state,
        match: {
          ...(state.match || {}),
          scores:   arrToScoreMap(p.scores, state.match?.scores),
          resolved: true,
          lastResolved: {
            index: p.index, byPlayerId: p.byPlayerId, correct: p.correct,
            answer: p.answer, timeout: !!p.timeout,
          },
        },
      }
    }

    // Sudoku: one cell changed (filled correct/wrong, or cleared)
    case 'SUDOKU_UPDATE': {
      const p = action.payload
      if (!state.match) return state
      const grid       = [...(state.match.grid || [])];       grid[p.index] = p.value
      const status     = [...(state.match.status || [])];     status[p.index] = p.status
      const wrongOwner = [...(state.match.wrongOwner || [])]; wrongOwner[p.index] = p.wrongOwner
      const correctOwner = [...(state.match.correctOwner || [])]; correctOwner[p.index] = p.correctOwner ?? null
      const editLock = { ...(state.match.editLock || {}) }; delete editLock[p.index]
      return {
        ...state,
        match: {
          ...state.match,
          grid, status, wrongOwner, correctOwner, editLock,
          scores:       arrToScoreMap(p.scores, state.match.scores),
          combo:        p.combo ?? state.match.combo,
          bestCombo:    p.bestCombo ?? state.match.bestCombo,
          mistakes:     p.mistakes ?? state.match.mistakes,
          mistakeLimit: p.mistakeLimit ?? state.match.mistakeLimit,
          correctCount: p.correctCount,
          wrongCount:   p.wrongCount,
          // Transient — drives the combo/points popup. `gained` is undefined for
          // clear events, so the HUD only animates on an actual fill.
          lastFill:     { index: p.index, by: p.by, gained: p.gained, combo: (p.combo && p.combo[p.by]) ?? 0, ts: Date.now() },
        },
      }
    }

    case 'SUDOKU_LOCK': {
      if (!state.match) return state
      return { ...state, match: { ...state.match, editLock: { ...(state.match.editLock || {}), [action.index]: action.by } } }
    }

    case 'SUDOKU_UNLOCK': {
      if (!state.match) return state
      const editLock = { ...(state.match.editLock || {}) }; delete editLock[action.index]
      return { ...state, match: { ...state.match, editLock } }
    }

    // I clicked Play Again → waiting for opponent's response
    case 'REMATCH_REQUESTING':
      return { ...state, rematchStatus: 'requesting' }

    // Opponent clicked Play Again → I need to respond
    case 'REMATCH_INCOMING':
      return { ...state, rematchStatus: 'incoming', rematchRequesterName: action.name }

    // Opponent declined my request
    case 'REMATCH_DECLINED':
      return { ...state, rematchStatus: 'declined', myTurn: false }

    // ── Chat ──────────────────────────────────────────────────────────────
    case 'CHAT_MESSAGE': {
      const msg = action.message
      const msgs = [...state.chatMessages, msg].slice(-50)
      return {
        ...state,
        chatMessages: msgs,
        unreadChat: msg.mine ? state.unreadChat : state.unreadChat + 1,
        lastIncomingChat: msg.mine ? state.lastIncomingChat : msg,
      }
    }

    case 'CHAT_CLEAR_UNREAD':
      return { ...state, unreadChat: 0 }

    case 'CHAT_CLEAR_TOAST':
      return { ...state, lastIncomingChat: null }

    // ── Friend requests ───────────────────────────────────────────────────
    case 'FRIEND_INCOMING':
      return { ...state, incomingFriend: { fromName: action.fromName, fromPlayerId: action.fromPlayerId, fromUserId: action.fromUserId } }
    case 'FRIEND_REQUESTED':
      return { ...state, friendStatus: 'requested' }
    case 'FRIEND_ACCEPTED':
      // Only raise the transient "X accepted" toast for a real accept event (carries
      // a name). checkFriendStatus also dispatches this (name-less) on room join just
      // to hide the add-friend button — that must NOT pop a toast.
      return {
        ...state,
        friendStatus: 'friends',
        incomingFriend: null,
        friendAccepted: action.name ? { name: action.name, ts: Date.now() } : state.friendAccepted,
      }
    case 'FRIEND_CLEAR_INCOMING':
      return { ...state, incomingFriend: null }
    case 'FRIEND_PRESENCE':   // a friend came online (transient toast signal)
      return { ...state, friendPresence: { name: action.name, online: action.online, ts: Date.now() } }

    // ── Emoji burst ───────────────────────────────────────────────────────
    case 'EMOJI_BURST':
      return { ...state, lastEmoji: action.payload }

    // Only mark as closed if the closed room is the one we're currently in.
    // NOTE: keep `room` intact — nulling it broke the redirect guard before.
    case 'ROOM_CLOSED_CHECK':
      if (!action.closedRoomId || state.room?.id === action.closedRoomId) {
        return { ...state, roomClosedByOpponent: true }
      }
      return state  // different room (stale event) — ignore

    case 'ROOM_CLOSED_BY_OPPONENT':
      return { ...state, roomClosedByOpponent: true }

    case 'OPPONENT_LEFT':
      return { ...state, opponentLeftMessage: action.message, roomClosedByOpponent: true, opponentConnLost: false, opponentCloseAt: null }

    case 'OPPONENT_CONN_LOST':
      return { ...state, opponentConnLost: true }

    case 'OPPONENT_CONN_RESTORED':
      return {
        ...state,
        opponentConnLost: false,
        opponentCloseAt: null,
        reconnectToast: action.name ? { name: action.name, ts: Date.now() } : state.reconnectToast,
      }

    // Full state rebuild after a reconnect (refresh / network drop)
    case 'RECONNECT_RESTORE': {
      const s = action.snapshot
      if (!s) return state
      const isOver = s.phase === 'GAME_OVER'
      const m = s.match || null
      // New game modes derive turn/winner from the match snapshot; guess modes
      // use the top-level turnId/winnerId fields.
      const turnId = m ? m.turnId : s.turnId
      return {
        ...state,
        room:    s.room,
        phase:   s.phase || 'IDLE',
        guesses: s.guesses || [],
        match:   m,
        myTurn:  !isOver && turnId === action.playerId,
        draw:    isOver ? !!(m && m.draw) : false,
        won:     isOver
          ? (m && m.draw ? null : (s.winnerId ? s.winnerId === action.playerId : null))
          : state.won,
        winnerId: s.winnerId || null,
        // Spin Battle: resume the turn countdown from the server's remaining ms.
        spin: m?.kind === 'SPIN' && m.turnCountdownMs
          ? { ...(state.spin || {}), turnEndsAt: Date.now() + m.turnCountdownMs }
          : state.spin,
        roomClosedByOpponent: false,
        opponentLeftMessage: null,
        // If we reconnected while the opponent is still mid-grace, surface the
        // "waiting…" state (not a normal board) and remember when the room closes.
        opponentConnLost: !isOver && !!s.opponentDisconnected,
        opponentCloseAt: (!isOver && s.opponentDisconnected)
          ? Date.now() + (s.roomClosesInMs ?? 0)
          : null,
      }
    }

    case 'MATCHMAKING':
      return { ...state, matchmaking: action.value, matchmakingTimedOut: false }

    case 'MATCHMAKING_TIMEOUT':
      return { ...state, matchmaking: false, matchmakingTimedOut: true }

    case 'ERROR':
      return { ...state, error: action.error }

    // Watching someone else's game — full public snapshot (no secrets, no turn).
    case 'SPECTATE_RESTORE': {
      const s = action.snapshot
      if (!s) return state
      const m = s.match || null
      const isOver = s.phase === 'GAME_OVER'
      return {
        ...state,
        isSpectator: true,
        room:    s.room,
        phase:   s.phase || 'IDLE',
        guesses: s.guesses || [],
        match:   m,
        myTurn:  false,
        won:     null,
        draw:    isOver ? !!(m && m.draw) : false,
        winnerId: s.winnerId || null,
        spin: m?.kind === 'SPIN' && m.turnCountdownMs
          ? { ...(state.spin || {}), turnEndsAt: Date.now() + m.turnCountdownMs } : state.spin,
        roomClosedByOpponent: false,
        opponentLeftMessage: null,
      }
    }

    // Public re-sync for watchers on a fresh deal / next game. Players ignore it.
    case 'SPECTATE_SYNC':
      if (!state.isSpectator) return state
      return {
        ...state,
        room:  action.room ? { ...state.room, ...action.room } : state.room,
        phase: 'PLAYING',
        match: action.match || state.match,
        myTurn: false,
        won: null, draw: false, winnerId: null, xoxRound: null,
      }

    case 'RESET':
      return INITIAL

    default:
      return state
  }
}

export function RoomProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const { socket } = useSocket()
  const { playerId } = usePlayer()
  const timerRef = useRef(null)

  useEffect(() => {
    if (!socket) return

    socket.on('room:updated', room => dispatch({ type: 'ROOM_UPDATED', room }))
    // room:closed — only act on it if it matches the room WE are currently in
    socket.on('room:closed', ({ roomId: closedRoomId } = {}) => {
      // Access current room via a ref to avoid stale closure
      dispatch({ type: 'ROOM_CLOSED_CHECK', closedRoomId })
    })

    // Player A (the waiter) receives this when a quick match is found for them
    socket.on('room:quickmatch_found', room => {
      dispatch({ type: 'MATCHMAKING', value: false })
      dispatch({ type: 'ROOM_UPDATED', room })
    })

    // No opponent found within the queue timeout → stop searching, offer retry.
    socket.on('room:quickmatch_timeout', () => {
      dispatch({ type: 'MATCHMAKING_TIMEOUT' })
    })

    socket.on('game:start', room =>
      dispatch({ type: 'GAME_START', room, playerId })
    )

    socket.on('game:turn', ({ playerId: tid }) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'TURN_CHANGE', playerId: tid, myId: playerId })
      timerRef.current = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000)
    })

    socket.on('game:guess_result', ({ playerId: guesser, guess, result, roast }) => {
      dispatch({
        type:       'GUESS_RESULT',
        entry:      { guesser, guess, result },
        result,
        roast,
        nextTurnId: result?.nextTurnId,
        playerId,
      })
    })

    // game:round_over carries { winnerId, scores } — pass them through
    socket.on('game:round_over', ({ winnerId, scores, secrets, matchOver } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'ROUND_OVER', winnerId, scores, secrets, matchOver: matchOver !== false, playerId })
    })

    // Forfeit: the person who forfeited loses; winnerId tells us who won
    socket.on('game:forfeit', ({ winnerId, forfeitPlayerId } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'ROUND_OVER', winnerId: winnerId || null, scores: null, matchOver: true, playerId })
    })

    // ── New game modes (XOX / Math Battle / Sudoku) ────────────────────────
    socket.on('match:start', ({ room, match } = {}) => {
      dispatch({ type: 'MATCH_START', room, match, playerId })
    })

    // Public re-sync for spectators on a fresh deal / next game (reducer ignores
    // it unless this client is actually spectating).
    socket.on('spectate:sync', ({ room, match } = {}) => {
      dispatch({ type: 'SPECTATE_SYNC', room, match })
    })

    socket.on('xox:update', ({ board, turnId } = {}) => {
      dispatch({ type: 'MATCH_STATE', patch: { board, turnId }, playerId })
    })
    socket.on('xox:roundover', (payload = {}) => {
      dispatch({ type: 'XOX_ROUNDOVER', payload, playerId })
    })

    // SOS: placement / claim / timeout — server sends the full public match.
    socket.on('sos:update', ({ match, lastCell, timedOut, by, bonusTo, bonusAmount } = {}) => {
      dispatch({ type: 'SOS_UPDATE', match, lastCell, timedOut, by, bonusTo, bonusAmount, playerId })
    })
    socket.on('sos:claimed', ({ match } = {}) => {
      dispatch({ type: 'SOS_UPDATE', match, playerId })
    })

    // RMCS (Raja Mantri): reveals/stage moves, round results, fresh deals.
    socket.on('rmcs:update', ({ match } = {}) => dispatch({ type: 'RMCS_UPDATE', match }))
    socket.on('rmcs:result', ({ match } = {}) => dispatch({ type: 'RMCS_UPDATE', match }))
    socket.on('rmcs:round',  (view = {})      => dispatch({ type: 'RMCS_ROUND', match: view.match }))

    // RUMMY: draw/discard/timeout patches (public, or personal with myHand).
    socket.on('rummy:update',   ({ match } = {}) => dispatch({ type: 'RUMMY_UPDATE', match, playerId }))
    socket.on('rummy:declared', (payload = {})   => dispatch({ type: 'RUMMY_DECLARED', payload }))

    // Puzzle race (Queens/Tango): a board update (mine carries myBoard; opponent's is progress-only).
    socket.on('race:update', ({ match } = {}) => dispatch({ type: 'RACE_UPDATE', match, playerId }))

    socket.on('math:question', (payload = {}) => {
      dispatch({ type: 'MATH_QUESTION', payload, playerId })
    })

    socket.on('math:resolved', (payload = {}) => {
      dispatch({ type: 'MATH_RESOLVED', payload, playerId })
    })

    socket.on('sudoku:update', (payload = {}) => {
      dispatch({ type: 'SUDOKU_UPDATE', payload, playerId })
    })
    socket.on('sudoku:lock', ({ index, by } = {}) => {
      dispatch({ type: 'SUDOKU_LOCK', index, by })
    })
    socket.on('sudoku:unlock', ({ index } = {}) => {
      dispatch({ type: 'SUDOKU_UNLOCK', index })
    })

    socket.on('spin:update', (payload = {}) => {
      dispatch({ type: 'SPIN_EVENT', payload, playerId })
    })
    socket.on('spin:round', (payload = {}) => {
      dispatch({ type: 'SPIN_ROUND', payload, playerId })
    })
    socket.on('spin:wrong', ({ letter } = {}) => {
      if (letter) dispatch({ type: 'SPIN_WRONG', letter })
    })
    socket.on('spin:turn', ({ turnCountdownMs } = {}) => {
      dispatch({ type: 'SPIN_TURN', turnCountdownMs })
    })

    socket.on('match:turn', ({ turnId, timerMs } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'TURN_CHANGE', playerId: turnId, myId: playerId, timerMs })
      timerRef.current = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000)
    })

    socket.on('match:over', ({ winnerId, draw, scores, ranking, series, reason } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'MATCH_OVER', winnerId: winnerId || null, draw: !!draw, scores, ranking: ranking || null, series: series || null, reason: reason || null, playerId })
    })

    socket.on('match:timeout', () => clearInterval(timerRef.current))
    socket.on('match:forfeit', () => clearInterval(timerRef.current))

    socket.on('game:rematch_start',    room => dispatch({ type: 'ROOM_UPDATED', room }))
    socket.on('game:rematch_incoming', ({ fromPlayerId, fromPlayerName }) => {
      // Ignore my own request (broadcast goes to the whole room incl. sender)
      if (fromPlayerId === playerId) return
      dispatch({ type: 'REMATCH_INCOMING', name: fromPlayerName })
    })
    socket.on('game:rematch_declined', () => dispatch({ type: 'REMATCH_DECLINED' }))
    socket.on('game:turn_timeout',    ()   => clearInterval(timerRef.current))

    // Opponent left / disconnected — show a message then redirect
    socket.on('game:opponent_left', ({ leaverName, reason } = {}) => {
      clearInterval(timerRef.current)
      const who = leaverName || 'Your opponent'
      const msg = reason === 'disconnected'
        ? `${who} disconnected.`
        : `${who} left the game.`
      dispatch({ type: 'OPPONENT_LEFT', message: msg })
    })

    // G4: opponent dropped (within grace) → show "reconnecting…" banner
    socket.on('player:disconnected', ({ playerId: pid } = {}) => {
      if (pid && pid !== playerId) dispatch({ type: 'OPPONENT_CONN_LOST' })
    })
    socket.on('player:reconnected', ({ playerId: pid, playerName } = {}) => {
      if (pid && pid !== playerId) dispatch({ type: 'OPPONENT_CONN_RESTORED', name: playerName })
    })

    // ── Chat + emoji ──────────────────────────────────────────────────────
    socket.on('chat:message', ({ fromPlayerId, fromName, text, ts }) => {
      dispatch({
        type: 'CHAT_MESSAGE',
        message: { id: `${ts}_${fromPlayerId}`, fromPlayerId, fromName, text, ts, mine: fromPlayerId === playerId },
      })
    })

    socket.on('chat:emoji', ({ fromPlayerId, emoji, ts }) => {
      dispatch({
        type: 'EMOJI_BURST',
        payload: { id: `${ts}_${Math.random().toString(36).slice(2)}`, emoji, mine: fromPlayerId === playerId },
      })
    })

    socket.on('friend:incoming', ({ fromName, fromPlayerId, fromUserId } = {}) => {
      dispatch({ type: 'FRIEND_INCOMING', fromName, fromPlayerId, fromUserId })
    })
    socket.on('friend:accepted', ({ name } = {}) => dispatch({ type: 'FRIEND_ACCEPTED', name }))
    // Presence: a friend came online / went offline (global, drives a brief toast).
    socket.on('friend:online',  ({ name } = {}) => dispatch({ type: 'FRIEND_PRESENCE', name, online: true }))

    return () => {
      socket.off('room:updated')
      socket.off('room:closed')   // same event name, handler is updated
      socket.off('room:quickmatch_found')
      socket.off('room:quickmatch_timeout')
      socket.off('game:start')
      socket.off('game:turn')
      socket.off('game:guess_result')
      socket.off('game:round_over')
      socket.off('game:forfeit')
      socket.off('match:start')
      socket.off('spectate:sync')
      socket.off('xox:update')
      socket.off('xox:roundover')
      socket.off('sos:update')
      socket.off('sos:claimed')
      socket.off('rmcs:update')
      socket.off('rmcs:result')
      socket.off('rmcs:round')
      socket.off('rummy:update')
      socket.off('rummy:declared')
      socket.off('race:update')
      socket.off('math:question')
      socket.off('math:resolved')
      socket.off('sudoku:update')
      socket.off('sudoku:lock')
      socket.off('sudoku:unlock')
      socket.off('spin:update')
      socket.off('spin:round')
      socket.off('spin:wrong')
      socket.off('spin:turn')
      socket.off('match:turn')
      socket.off('match:over')
      socket.off('match:timeout')
      socket.off('match:forfeit')
      socket.off('game:rematch_start')
      socket.off('game:rematch_incoming')
      socket.off('game:rematch_declined')
      socket.off('game:turn_timeout')
      socket.off('chat:message')
      socket.off('chat:emoji')
      socket.off('friend:incoming')
      socket.off('friend:accepted')
      socket.off('friend:online')
      socket.off('game:opponent_left')
      socket.off('player:disconnected')
      socket.off('player:reconnected')
      clearInterval(timerRef.current)
    }
  }, [socket, playerId])

  const createRoom = useCallback(async (opts) => {
    const r = await emitAck(socket, 'room:create', opts)
    if (r.ok) dispatch({ type: 'ROOM_UPDATED', room: r.room })
    else dispatch({ type: 'ERROR', error: r.error })
    return r
  }, [socket])

  const joinRoom = useCallback(async (code) => {
    const r = await emitAck(socket, 'room:join', { code })
    if (r.ok) dispatch({ type: 'ROOM_UPDATED', room: r.room })
    else dispatch({ type: 'ERROR', error: r.error })
    return r
  }, [socket])

  const quickMatch = useCallback(async (mode, difficulty) => {
    if (!socket) return { ok: false, error: 'Not connected' }
    dispatch({ type: 'MATCHMAKING', value: true })
    // Longer window — matchmaking may legitimately wait for a partner.
    const r = await emitAck(socket, 'room:quickmatch', { mode, difficulty }, 12000)
    if (!r.ok || r.matched) dispatch({ type: 'MATCHMAKING', value: false })
    if (r.ok && r.matched) dispatch({ type: 'ROOM_UPDATED', room: r.room })
    else if (!r.ok) dispatch({ type: 'ERROR', error: r.error })
    return r
  }, [socket])

  const cancelQuickMatch = useCallback(() => {
    socket?.emit('room:quickmatch_cancel')
    dispatch({ type: 'MATCHMAKING', value: false })
  }, [socket])

  const setReady = useCallback((roomId, secret) => {
    socket?.emit('game:ready', { roomId, secret })
  }, [socket])

  // Reconnect to a room and rebuild full game state from the server snapshot.
  // Returns the snapshot (so the page can restore its own refs, e.g. secret).
  const reconnectRoom = useCallback(async (roomId) => {
    const r = await emitAck(socket, 'room:reconnect', { roomId }, 10000)
    if (r?.ok && r.snapshot) {
      dispatch({ type: 'RECONNECT_RESTORE', snapshot: r.snapshot, playerId })
    }
    return r || { ok: false }
  }, [socket, playerId])

  const submitGuess = useCallback((roomId, guess) => {
    socket?.emit('game:guess', { roomId, guess })
  }, [socket])

  // ── New game modes (XOX / Math Battle / Sudoku) ─────────────────────────
  const matchReady = useCallback((roomId) => emitAck(socket, 'match:ready', { roomId }), [socket])

  const hostStart = useCallback((roomId) => emitAck(socket, 'match:host_start', { roomId }), [socket])

  const xoxMove = useCallback((roomId, cell) => {
    socket?.emit('xox:move', { roomId, cell })
  }, [socket])

  const sosMove  = useCallback((roomId, cell, letter) => socket?.emit('sos:move',  { roomId, cell, letter }), [socket])
  const sosClaim = useCallback((roomId, cells)        => socket?.emit('sos:claim', { roomId, cells }),        [socket])

  // RMCS (Raja Mantri) — acks let the UI surface "only the host…" style errors.
  const rmcsReveal = useCallback((roomId)            => emitAck(socket, 'rmcs:reveal', { roomId }),            [socket])
  const rmcsGuess  = useCallback((roomId, suspectId) => emitAck(socket, 'rmcs:guess',  { roomId, suspectId }), [socket])
  const rmcsNext   = useCallback((roomId)            => emitAck(socket, 'rmcs:next',   { roomId }),            [socket])
  const rmcsEnd    = useCallback((roomId)            => emitAck(socket, 'rmcs:end',    { roomId }),            [socket])
  const rmcsRematch = useCallback((roomId)           => emitAck(socket, 'rmcs:rematch', { roomId }),           [socket])
  // Seat-filler bots (RMCS) — host adds/removes in the lobby so 1–3 friends can play.
  const addBot    = useCallback((roomId)          => emitAck(socket, 'room:add_bot',    { roomId }),        [socket])
  const removeBot = useCallback((roomId, botId)   => emitAck(socket, 'room:remove_bot', { roomId, botId }), [socket])

  const mathAnswer = useCallback((roomId, index, choice) => {
    socket?.emit('math:answer', { roomId, index, choice })
  }, [socket])

  const sudokuLock   = useCallback((roomId, index)        => socket?.emit('sudoku:lock',   { roomId, index }),        [socket])
  const sudokuUnlock = useCallback((roomId, index)        => socket?.emit('sudoku:unlock', { roomId, index }),        [socket])
  const sudokuFill   = useCallback((roomId, index, value) => socket?.emit('sudoku:fill',   { roomId, index, value }), [socket])
  const sudokuClear  = useCallback((roomId, index)        => socket?.emit('sudoku:clear',  { roomId, index }),        [socket])

  // Rummy — acks surface "Not your turn" / invalid-declaration reasons to the UI.
  const rummyDraw    = useCallback((roomId, source)              => emitAck(socket, 'rummy:draw',    { roomId, source }),                  [socket])
  const rummyDiscard = useCallback((roomId, cardId)              => emitAck(socket, 'rummy:discard', { roomId, cardId }),                  [socket])
  const rummyDeclare = useCallback((roomId, groups, discardCardId) => emitAck(socket, 'rummy:declare', { roomId, groups, discardCardId }), [socket])

  // Queens — place/mark/clear a cell on your own board (ack returns { solved }).
  const queensPlace = useCallback((roomId, index, state) => emitAck(socket, 'queens:place', { roomId, index, state }), [socket])
  const tangoPlace  = useCallback((roomId, index, state) => emitAck(socket, 'tango:place',  { roomId, index, state }), [socket])
  // Zip sends the whole drawn path; high-frequency during a drag, so plain emit (no ack).
  const zipPath     = useCallback((roomId, path) => socket?.emit('zip:path', { roomId, path }), [socket])
  // Give up a race (forfeit this puzzle) → you're done and switch to watching the others.
  const raceGiveUp  = useCallback((roomId) => emitAck(socket, 'race:giveup', { roomId }), [socket])
  // Host runs the race back with a fresh puzzle once everyone's done.
  const raceRematch = useCallback((roomId) => emitAck(socket, 'race:rematch', { roomId }), [socket])
  // Finished watcher points a cell out (toggle) on a still-solving opponent's board — live for both.
  const raceHighlight = useCallback((roomId, targetId, index) => emitAck(socket, 'race:highlight', { roomId, targetId, index }), [socket])

  const spinSpin  = useCallback((roomId)          => socket?.emit('spin:spin',  { roomId }),          [socket])
  const spinGuess = useCallback((roomId, letter)  => socket?.emit('spin:guess', { roomId, letter }),  [socket])
  const spinVowel = useCallback((roomId, letter)  => socket?.emit('spin:vowel', { roomId, letter }),  [socket])
  const spinSolve = useCallback((roomId, attempt) => socket?.emit('spin:solve', { roomId, attempt }), [socket])

  const matchForfeit = useCallback((roomId) => {
    socket?.emit('match:forfeit', { roomId })
  }, [socket])

  // I click "Play Again" → send request to opponent
  const requestRematch = useCallback((roomId) => {
    dispatch({ type: 'REMATCH_REQUESTING' })
    socket?.emit('game:rematch_request', { roomId })
  }, [socket])

  // I (responder) click Yes
  const acceptRematch = useCallback((roomId) => {
    socket?.emit('game:rematch_accept', { roomId })
  }, [socket])

  // I (responder) click No — close room for everyone
  const declineRematch = useCallback((roomId) => {
    socket?.emit('game:rematch_decline', { roomId })
    dispatch({ type: 'RESET' })
  }, [socket])

  const leaveRoom = useCallback((roomId) => {
    socket?.emit('room:leave', { roomId })
    dispatch({ type: 'RESET' })
  }, [socket])

  // Clear local room state WITHOUT telling the server (room already closed,
  // or we're just leaving the page). Prevents a stale room from lingering.
  const clearRoom = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  // Start watching: get the public snapshot back, then receive live broadcasts.
  const spectate = useCallback(async (roomId) => {
    const r = await emitAck(socket, 'room:spectate', { roomId })
    if (r?.ok) dispatch({ type: 'SPECTATE_RESTORE', snapshot: r, playerId })
    return r || { ok: false }
  }, [socket, playerId])

  const unspectate = useCallback((roomId) => {
    socket?.emit('room:unspectate', { roomId })
    dispatch({ type: 'RESET' })
  }, [socket])

  // ── Chat + emoji actions ──────────────────────────────────────────────
  const sendChat = useCallback((roomId, text) => {
    const clean = (text || '').trim()
    if (!clean) return
    socket?.emit('chat:message', { roomId, text: clean })
  }, [socket])

  const sendEmoji = useCallback((roomId, emoji) => {
    socket?.emit('chat:emoji', { roomId, emoji })
  }, [socket])

  const clearUnreadChat = useCallback(() => {
    dispatch({ type: 'CHAT_CLEAR_UNREAD' })
  }, [])

  const clearChatToast = useCallback(() => dispatch({ type: 'CHAT_CLEAR_TOAST' }), [])

  // ── Friend requests ─────────────────────────────────────────────────────
  const sendFriendRequest = useCallback((roomId) => {
    return new Promise(res => {
      if (!socket) return res({ ok: false })
      socket.emit('friend:request', { roomId }, r => {
        if (r?.ok) dispatch({ type: 'FRIEND_REQUESTED' })
        res(r || { ok: false })
      })
    })
  }, [socket])

  const acceptFriendRequest = useCallback((roomId) => {
    socket?.emit('friend:accept', { roomId })
  }, [socket])

  // Ask the server whether we're already friends with the current opponent
  // (e.g. from a past session) so the add-friend button starts hidden.
  const checkFriendStatus = useCallback((roomId) => {
    socket?.emit('friend:status', { roomId }, r => {
      if (r?.status === 'friends') dispatch({ type: 'FRIEND_ACCEPTED' })
    })
  }, [socket])

  const clearIncomingFriend = useCallback(() => dispatch({ type: 'FRIEND_CLEAR_INCOMING' }), [])

  return (
    <RoomContext.Provider value={{
      state, createRoom, joinRoom, quickMatch, cancelQuickMatch,
      setReady, submitGuess, requestRematch, acceptRematch, declineRematch, leaveRoom, clearRoom, spectate, unspectate,
      sendChat, sendEmoji, clearUnreadChat, reconnectRoom,
      clearChatToast, sendFriendRequest, acceptFriendRequest, checkFriendStatus, clearIncomingFriend,
      matchReady, hostStart, xoxMove, sosMove, sosClaim, matchForfeit, mathAnswer,
      sudokuLock, sudokuUnlock, sudokuFill, sudokuClear,
      spinSpin, spinGuess, spinVowel, spinSolve,
      rmcsReveal, rmcsGuess, rmcsNext, rmcsEnd, rmcsRematch, addBot, removeBot,
      rummyDraw, rummyDiscard, rummyDeclare,
      queensPlace, tangoPlace, zipPath, raceGiveUp, raceRematch, raceHighlight,
    }}>
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider')
  return ctx
}
