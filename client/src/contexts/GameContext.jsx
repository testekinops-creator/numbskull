import { createContext, useContext, useReducer, useCallback } from 'react'
import { api } from '../services/api.js'

const GameContext = createContext(null)

const INITIAL_STATE = {
  phase: 'IDLE',
  mode: null,
  difficulty: 'medium',
  range: 100,
  sessionId: null,
  attempts: 0,
  maxGuesses: null,
  guesses: [],
  lastResult: null,
  roast: null,
  totalGames: 0,
  gtnWins: 0,
  won: false,
  over: false,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'START_GAME':
      return {
        ...INITIAL_STATE,
        phase: 'PLAYING',
        mode: action.mode,
        difficulty: action.difficulty,
        range: action.range,
        maxGuesses: action.maxGuesses ?? null,
        sessionId: action.sessionId,
        totalGames: state.totalGames,
        gtnWins: state.gtnWins,
      }

    case 'GUESS_RESULT': {
      const result = action.result
      const newGuesses = [...state.guesses, { value: action.guess, result }]
      if (result.correct || result.over) {
        return {
          ...state,
          phase: 'GAME_OVER',
          guesses: newGuesses,
          attempts: result.attempts || newGuesses.length,
          lastResult: result,
          won: !!result.won,
          over: true,
          totalGames: state.totalGames + 1,
          gtnWins: state.mode === 'GTN' && result.won ? state.gtnWins + 1 : state.gtnWins,
          roast: action.roast || null,
        }
      }
      return {
        ...state,
        guesses: newGuesses,
        attempts: result.attempts || newGuesses.length,
        lastResult: result,
        roast: action.roast || null,
      }
    }

    case 'SET_ROAST':
      return { ...state, roast: action.roast }

    case 'RESET':
      return { ...INITIAL_STATE, totalGames: state.totalGames, gtnWins: state.gtnWins }

    case 'SET_ERROR':
      return { ...state, error: action.error }

    default:
      return state
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const startGame = useCallback(async ({ mode, difficulty = 'medium', range = 100 }) => {
    dispatch({ type: 'RESET' })
    try {
      const data = await api.post('/game/start', { mode, difficulty, range })
      dispatch({ type: 'START_GAME', mode, difficulty, range: data.range, maxGuesses: data.maxGuesses, sessionId: data.sessionId })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [])

  const submitGuess = useCallback(async (guess) => {
    if (state.phase !== 'PLAYING' || !state.sessionId) return
    try {
      const data = await api.post('/game/guess', { guess, sessionId: state.sessionId, totalGames: state.totalGames })
      dispatch({ type: 'GUESS_RESULT', guess, result: data, roast: data.roast })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message })
    }
  }, [state.phase, state.sessionId])

  const resetGame = useCallback(() => dispatch({ type: 'RESET' }), [])

  const bcUnlocked = state.gtnWins >= 3

  return (
    <GameContext.Provider value={{ state, startGame, submitGuess, resetGame, bcUnlocked }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used inside GameProvider')
  return ctx
}
