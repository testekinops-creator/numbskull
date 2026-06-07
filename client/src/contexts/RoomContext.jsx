import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { useSocket } from './SocketContext.jsx'
import { usePlayer } from './PlayerContext.jsx'

const RoomContext = createContext(null)

const INITIAL = {
  room:                 null,
  phase:                'IDLE',
  guesses:              [],
  myTurn:               false,
  turnTimeLeft:         30,
  lastGuessResult:      null,
  roast:                null,
  error:                null,
  matchmaking:          false,
  won:                  null,
  winnerId:             null,
  draw:                 false,
  // New game modes (XOX / Math Battle / Sudoku) — generic real-time match state
  match:                null,
  // Spin Battle: last wheel/guess event (drives the wheel animation + feedback)
  spin:                 null,
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
  incomingFriend:       null,  // { fromName, fromPlayerId } — opponent asked to be friends
  friendStatus:         'idle',// idle | requested | friends
  // Opponent left / room closed — drives redirect + message
  opponentLeftMessage:  null,
  // Opponent temporarily dropped (within grace) — drives "reconnecting…" banner
  opponentConnLost:     false,
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
      } : {}
      return {
        ...state,
        ...rematchReset,
        room:                 action.room,
        phase:                newPhase,
        error:                null,
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

    case 'TURN_CHANGE':
      return { ...state, myTurn: action.playerId === action.myId, turnTimeLeft: 30 }

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
      }
    }

    // ── New game modes (XOX / Math / Sudoku) ───────────────────────────────
    // Match started — server sends { room (summary), match (public state) }
    case 'MATCH_START':
      return {
        ...state,
        room:  action.room ? { ...state.room, ...action.room } : state.room,
        phase: 'PLAYING',
        match: action.match,
        spin:  null,
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
          passed: p.passed, solved: p.solved,
          winnerId: p.winnerId, matchOver: p.matchOver,
          ts: Date.now(),
        },
      }
    }

    // Spin Battle: a fresh round started.
    case 'SPIN_ROUND': {
      const p = action.payload || {}
      const match = p.match ? { ...state.match, ...p.match } : state.match
      return {
        ...state,
        match,
        myTurn: match?.turnId === action.playerId,
        spin: { ...(state.spin || {}), event: 'newround', round: p.round, ts: Date.now() },
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
      const editLock = { ...(state.match.editLock || {}) }; delete editLock[p.index]
      return {
        ...state,
        match: {
          ...state.match,
          grid, status, wrongOwner, editLock,
          scores:       arrToScoreMap(p.scores, state.match.scores),
          correctCount: p.correctCount,
          wrongCount:   p.wrongCount,
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
      return { ...state, incomingFriend: { fromName: action.fromName, fromPlayerId: action.fromPlayerId } }
    case 'FRIEND_REQUESTED':
      return { ...state, friendStatus: 'requested' }
    case 'FRIEND_ACCEPTED':
      return { ...state, friendStatus: 'friends', incomingFriend: null }
    case 'FRIEND_CLEAR_INCOMING':
      return { ...state, incomingFriend: null }

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
      return { ...state, opponentLeftMessage: action.message, roomClosedByOpponent: true, opponentConnLost: false }

    case 'OPPONENT_CONN_LOST':
      return { ...state, opponentConnLost: true }

    case 'OPPONENT_CONN_RESTORED':
      return { ...state, opponentConnLost: false }

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
        roomClosedByOpponent: false,
        opponentLeftMessage: null,
        opponentConnLost: false,
      }
    }

    case 'MATCHMAKING':
      return { ...state, matchmaking: action.value }

    case 'ERROR':
      return { ...state, error: action.error }

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
    socket.on('game:round_over', ({ winnerId, scores } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'ROUND_OVER', winnerId, scores, playerId })
    })

    // Forfeit: the person who forfeited loses; winnerId tells us who won
    socket.on('game:forfeit', ({ winnerId, forfeitPlayerId } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'ROUND_OVER', winnerId: winnerId || null, scores: null, playerId })
    })

    // ── New game modes (XOX / Math Battle / Sudoku) ────────────────────────
    socket.on('match:start', ({ room, match } = {}) => {
      dispatch({ type: 'MATCH_START', room, match, playerId })
    })

    socket.on('xox:update', ({ board, turnId } = {}) => {
      dispatch({ type: 'MATCH_STATE', patch: { board, turnId }, playerId })
    })

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

    socket.on('match:turn', ({ turnId } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'TURN_CHANGE', playerId: turnId, myId: playerId })
      timerRef.current = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000)
    })

    socket.on('match:over', ({ winnerId, draw, scores } = {}) => {
      clearInterval(timerRef.current)
      dispatch({ type: 'MATCH_OVER', winnerId: winnerId || null, draw: !!draw, scores, playerId })
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
    socket.on('player:reconnected', ({ playerId: pid } = {}) => {
      if (pid && pid !== playerId) dispatch({ type: 'OPPONENT_CONN_RESTORED' })
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

    socket.on('friend:incoming', ({ fromName, fromPlayerId } = {}) => {
      dispatch({ type: 'FRIEND_INCOMING', fromName, fromPlayerId })
    })
    socket.on('friend:accepted', () => dispatch({ type: 'FRIEND_ACCEPTED' }))

    return () => {
      socket.off('room:updated')
      socket.off('room:closed')   // same event name, handler is updated
      socket.off('room:quickmatch_found')
      socket.off('game:start')
      socket.off('game:turn')
      socket.off('game:guess_result')
      socket.off('game:round_over')
      socket.off('game:forfeit')
      socket.off('match:start')
      socket.off('xox:update')
      socket.off('math:question')
      socket.off('math:resolved')
      socket.off('sudoku:update')
      socket.off('sudoku:lock')
      socket.off('sudoku:unlock')
      socket.off('spin:update')
      socket.off('spin:round')
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
      socket.off('game:opponent_left')
      socket.off('player:disconnected')
      socket.off('player:reconnected')
      clearInterval(timerRef.current)
    }
  }, [socket, playerId])

  const createRoom = useCallback(async (opts) => {
    if (!socket) return
    return new Promise(res => socket.emit('room:create', opts, r => {
      if (r.ok) dispatch({ type: 'ROOM_UPDATED', room: r.room })
      else dispatch({ type: 'ERROR', error: r.error })
      res(r)
    }))
  }, [socket])

  const joinRoom = useCallback(async (code) => {
    if (!socket) return
    return new Promise(res => socket.emit('room:join', { code }, r => {
      if (r.ok) dispatch({ type: 'ROOM_UPDATED', room: r.room })
      else dispatch({ type: 'ERROR', error: r.error })
      res(r)
    }))
  }, [socket])

  const quickMatch = useCallback(async (mode, difficulty) => {
    if (!socket) return
    dispatch({ type: 'MATCHMAKING', value: true })
    return new Promise(res => socket.emit('room:quickmatch', { mode, difficulty }, r => {
      if (!r.ok || r.matched) dispatch({ type: 'MATCHMAKING', value: false })
      if (r.ok && r.matched) dispatch({ type: 'ROOM_UPDATED', room: r.room })
      else if (!r.ok) dispatch({ type: 'ERROR', error: r.error })
      res(r)
    }))
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
  const reconnectRoom = useCallback((roomId) => {
    return new Promise(res => {
      if (!socket) return res({ ok: false })
      socket.emit('room:reconnect', { roomId }, r => {
        if (r?.ok && r.snapshot) {
          dispatch({ type: 'RECONNECT_RESTORE', snapshot: r.snapshot, playerId })
        }
        res(r || { ok: false })
      })
    })
  }, [socket, playerId])

  const submitGuess = useCallback((roomId, guess) => {
    socket?.emit('game:guess', { roomId, guess })
  }, [socket])

  // ── New game modes (XOX / Math Battle / Sudoku) ─────────────────────────
  const matchReady = useCallback((roomId) => {
    socket?.emit('match:ready', { roomId })
  }, [socket])

  const xoxMove = useCallback((roomId, cell) => {
    socket?.emit('xox:move', { roomId, cell })
  }, [socket])

  const mathAnswer = useCallback((roomId, index, choice) => {
    socket?.emit('math:answer', { roomId, index, choice })
  }, [socket])

  const sudokuLock   = useCallback((roomId, index)        => socket?.emit('sudoku:lock',   { roomId, index }),        [socket])
  const sudokuUnlock = useCallback((roomId, index)        => socket?.emit('sudoku:unlock', { roomId, index }),        [socket])
  const sudokuFill   = useCallback((roomId, index, value) => socket?.emit('sudoku:fill',   { roomId, index, value }), [socket])
  const sudokuClear  = useCallback((roomId, index)        => socket?.emit('sudoku:clear',  { roomId, index }),        [socket])

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

  const spectate = useCallback((roomId) => {
    socket?.emit('room:spectate', { roomId })
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
      setReady, submitGuess, requestRematch, acceptRematch, declineRematch, leaveRoom, clearRoom, spectate,
      sendChat, sendEmoji, clearUnreadChat, reconnectRoom,
      clearChatToast, sendFriendRequest, acceptFriendRequest, checkFriendStatus, clearIncomingFriend,
      matchReady, xoxMove, matchForfeit, mathAnswer,
      sudokuLock, sudokuUnlock, sudokuFill, sudokuClear,
      spinSpin, spinGuess, spinVowel, spinSolve,
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
