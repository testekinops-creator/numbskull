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
  // Rematch state machine: idle | requesting | incoming | declined
  rematchStatus:        'idle',
  rematchRequesterName: null,  // name of who sent the request
  roomClosedByOpponent: false,
}

function reducer(state, action) {
  switch (action.type) {

    case 'ROOM_UPDATED': {
      const newPhase = action.room?.phase || 'IDLE'
      const rematchReset = newPhase === 'SETUP' ? {
        rematchStatus: 'idle', rematchRequesterName: null,
        won: null, winnerId: null,
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

    // I clicked Play Again → waiting for opponent's response
    case 'REMATCH_REQUESTING':
      return { ...state, rematchStatus: 'requesting' }

    // Opponent clicked Play Again → I need to respond
    case 'REMATCH_INCOMING':
      return { ...state, rematchStatus: 'incoming', rematchRequesterName: action.name }

    // Opponent declined my request
    case 'REMATCH_DECLINED':
      return { ...state, rematchStatus: 'declined', myTurn: false }

    // Only mark as closed if the closed room is the one we're currently in
    case 'ROOM_CLOSED_CHECK':
      if (!action.closedRoomId || state.room?.id === action.closedRoomId) {
        return { ...state, roomClosedByOpponent: true, room: null }
      }
      // Different room closed (stale event from old session) — ignore
      return state

    case 'ROOM_CLOSED_BY_OPPONENT':
      return { ...state, roomClosedByOpponent: true, room: null }

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

    socket.on('game:rematch_start',    room => dispatch({ type: 'ROOM_UPDATED', room }))
    socket.on('game:rematch_incoming', ({ fromPlayerId, fromPlayerName }) => {
      // Ignore my own request (broadcast goes to the whole room incl. sender)
      if (fromPlayerId === playerId) return
      dispatch({ type: 'REMATCH_INCOMING', name: fromPlayerName })
    })
    socket.on('game:rematch_declined', () => dispatch({ type: 'REMATCH_DECLINED' }))
    socket.on('game:turn_timeout',    ()   => clearInterval(timerRef.current))

    return () => {
      socket.off('room:updated')
      socket.off('room:closed')   // same event name, handler is updated
      socket.off('room:quickmatch_found')
      socket.off('game:start')
      socket.off('game:turn')
      socket.off('game:guess_result')
      socket.off('game:round_over')
      socket.off('game:forfeit')
      socket.off('game:rematch_start')
      socket.off('game:rematch_incoming')
      socket.off('game:rematch_declined')
      socket.off('game:turn_timeout')
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

  const quickMatch = useCallback(async (mode) => {
    if (!socket) return
    dispatch({ type: 'MATCHMAKING', value: true })
    return new Promise(res => socket.emit('room:quickmatch', { mode }, r => {
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

  const submitGuess = useCallback((roomId, guess) => {
    socket?.emit('game:guess', { roomId, guess })
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

  const spectate = useCallback((roomId) => {
    socket?.emit('room:spectate', { roomId })
  }, [socket])

  return (
    <RoomContext.Provider value={{
      state, createRoom, joinRoom, quickMatch, cancelQuickMatch,
      setReady, submitGuess, requestRematch, acceptRematch, declineRematch, leaveRoom, spectate,
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
