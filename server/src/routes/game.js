import { Router } from 'express'
import { z } from 'zod'
import { engineFactory, VALID_MODES } from '../game/engineFactory.js'
import { MathBattleEngine } from '../game/engines/MathBattleEngine.js'
import { getRoastMessage } from '../game/personality.js'
import { getActiveEvent, applyEventModifier } from '../game/SeasonalEvents.js'
import { createError } from '../middleware/errorHandler.js'
import { optionalAuth } from '../middleware/auth.js'
import { AuthService } from '../services/AuthService.js'
import { generateRoast } from '../game/RoastGenerator.js'

export const gameRouter = Router()

// ── AI-style roast generator (for in-game chat) ────────────────────────────
gameRouter.get('/roast', (_req, res) => {
  res.json({ success: true, data: { roast: generateRoast() } })
})

// ── Record a finished game for the logged-in user ──────────────────────────
const recordSchema = z.object({
  mode: z.enum(['GTN', 'BC', 'COUNTDOWN', 'NUMBER_CHAIN', 'NUMBER_TOWERS', 'REVERSE', 'XOX', 'MATH', 'SUDOKU', 'SPIN', 'RUMMY']),
  won:  z.boolean(),
})

// Anti-inflation: a real game can't finish more than once every few seconds.
const lastRecordAt = new Map()  // userId -> ts
const RECORD_COOLDOWN_MS = 3000

gameRouter.post('/record', optionalAuth, async (req, res, next) => {
  try {
    const { mode, won } = recordSchema.parse(req.body)
    // Guests have no DB record — silently skip
    if (!req.userId) return res.json({ success: true, data: { recorded: false } })

    // Throttle rapid repeats from the same account (cheap stat-inflation guard)
    const now = Date.now()
    const last = lastRecordAt.get(req.userId) || 0
    if (now - last < RECORD_COOLDOWN_MS) {
      return res.json({ success: true, data: { recorded: false, throttled: true } })
    }
    lastRecordAt.set(req.userId, now)

    const user = await AuthService.getUser(req.userId)
    if (!user) return res.json({ success: true, data: { recorded: false } })

    const patch = { totalGames: user.totalGames + 1 }
    if (won && mode === 'GTN')    patch.gtnWins    = user.gtnWins + 1
    if (won && mode === 'BC')     patch.bcWins     = user.bcWins  + 1
    if (won && mode === 'XOX')    patch.xoxWins    = (user.xoxWins    || 0) + 1
    if (won && mode === 'MATH')   patch.mathWins   = (user.mathWins   || 0) + 1
    if (won && mode === 'SUDOKU') patch.sudokuWins = (user.sudokuWins || 0) + 1
    if (won && mode === 'RUMMY')  patch.rummyWins  = (user.rummyWins  || 0) + 1

    const updated = await AuthService.updateUser(req.userId, patch)
    res.json({ success: true, data: { recorded: true, user: AuthService.publicProfile(updated) } })
  } catch (err) { next(err) }
})

const startSchema = z.object({
  mode:       z.enum(VALID_MODES),
  difficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).default('medium'),
  range:      z.number().int().positive().optional(),
  totalGames: z.number().int().min(0).default(0),
  largeCount: z.number().int().min(0).max(4).optional(),
  symbol:     z.enum(['X', 'O']).optional(),   // XOX: which symbol the human plays
  endless:    z.boolean().optional(),          // MATH: survival mode (no fixed total)
  boardSize:  z.number().int().optional(),     // SOS: 8 or 10 (engine clamps)
})

const guessSchema = z.object({
  guess:      z.union([z.number().int(), z.string()]),
  sessionId:  z.string(),
  totalGames: z.number().int().min(0).default(0),
})

const moveSchema = z.object({
  op:         z.string(),
  operand:    z.number().int(),
  sessionId:  z.string(),
})

const submitSchema = z.object({
  expression: z.string(),
  sessionId:  z.string(),
  totalGames: z.number().int().min(0).default(0),
})

const placeSchema = z.object({
  slot:      z.number().int().min(0).max(4),
  sessionId: z.string(),
})

const sessions = new Map()

gameRouter.post('/start', (req, res, next) => {
  try {
    const { mode, difficulty, range, largeCount, symbol, endless, boardSize } = startSchema.parse(req.body)
    const event    = getActiveEvent()
    const baseOpts = { difficulty, range, largeCount, symbol, boardSize }
    const opts     = applyEventModifier(baseOpts, event)
    const engine   = engineFactory(mode, opts)
    const sessionId = uid()
    const session  = { engine, mode, event: event?.id || null }
    // Math Battle tracks progression + per-side scores on the session.
    if (mode === 'MATH') { session.mathIndex = 0; session.mathScores = { player: 0, ai: 0 }; session.endless = !!endless }
    sessions.set(sessionId, session)
    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000)

    // XOX: if the human chose O, the AI (X) opens immediately so the board
    // already reflects the first move when the client renders.
    let state = engine.getState ? engine.getState() : {}
    if (mode === 'XOX')  state = engine.aiOpeningMove()
    if (mode === 'MATH') state = { ...state, scores: { player: 0, ai: 0 }, endless: !!endless }

    res.json({ success: true, data: { sessionId, mode, range: engine.range, event: event?.id || null, ...state } })
  } catch (err) { next(err) }
})

// ── XOX (Tic-Tac-Toe) AI move ──────────────────────────────────────────────
const xoxMoveSchema = z.object({
  cell:       z.number().int().min(0).max(8),
  sessionId:  z.string(),
  totalGames: z.number().int().min(0).default(0),
})

gameRouter.post('/xox/move', (req, res, next) => {
  try {
    const { cell, sessionId, totalGames } = xoxMoveSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')

    const result = session.engine.playerMove(cell)

    let roastEvent = null
    if (result.over) {
      roastEvent = result.draw ? 'lose' : (result.winner === result.playerSymbol ? 'correct' : 'lose')
    }
    const roast = roastEvent ? getRoastMessage(roastEvent, totalGames) : null
    if (result.over) sessions.delete(sessionId)

    res.json({ success: true, data: { ...result, roast: roast?.message || null } })
  } catch (err) { next(err) }
})

// ── SOS (vs AI) move ────────────────────────────────────────────────────────
const sosMoveSchema = z.object({
  cell:       z.number().int().min(0),
  letter:     z.enum(['S', 'O']),
  sessionId:  z.string(),
  totalGames: z.number().int().min(0).default(0),
})

gameRouter.post('/sos/move', (req, res, next) => {
  try {
    const { cell, letter, sessionId, totalGames } = sosMoveSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')

    const result = session.engine.playerMove(cell, letter)

    const roastEvent = result.over ? (result.winner === 'player' ? 'correct' : 'lose') : null
    const roast = roastEvent ? getRoastMessage(roastEvent, totalGames) : null
    if (result.over) sessions.delete(sessionId)

    res.json({ success: true, data: { ...result, roast: roast?.message || null } })
  } catch (err) { next(err) }
})

// ── GTN / BC / REVERSE guess ─────────────────────────────────────────────
gameRouter.post('/guess', (req, res, next) => {
  try {
    const { guess, sessionId, totalGames } = guessSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const { engine, mode } = session

    let result
    if (mode === 'REVERSE') result = engine.guess(guess)
    else result = engine.evaluate(guess)

    let roastEvent = null
    if (result.valid) {
      if (result.correct || result.won) roastEvent = mode === 'BC' ? 'win_bc' : 'correct'
      else if (result.over && !result.won) roastEvent = 'lose'
      else if (result.direction === 'higher') roastEvent = 'wrong_low'
      else if (result.direction === 'lower')  roastEvent = 'wrong_high'
    }
    const roast = roastEvent ? getRoastMessage(roastEvent, totalGames) : null
    if (result.correct || result.over) sessions.delete(sessionId)

    res.json({ success: true, data: { ...result, roast: roast?.message || null } })
  } catch (err) { next(err) }
})

// ── Math Battle answer (single-player AI race) ─────────────────────────────
// `by` is 'player' (the human picked an option) or 'ai' (the AI buzzed first).
// The first answer for the current index locks the question; later answers for
// an already-advanced index are reported as stale and scored to nobody.
const mathAnswerSchema = z.object({
  sessionId:  z.string(),
  index:      z.number().int().min(0),
  by:         z.enum(['player', 'ai']),
  choice:     z.union([z.number().int(), z.string()]).optional(),
  totalGames: z.number().int().min(0).default(0),
})

gameRouter.post('/math/answer', (req, res, next) => {
  try {
    const { sessionId, index, by, choice, totalGames } = mathAnswerSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session || session.mode !== 'MATH') throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const { engine } = session

    // The question already advanced — this answer lost the race.
    if (index !== session.mathIndex) {
      return res.json({ success: true, data: { stale: true, index: session.mathIndex, scores: { ...session.mathScores } } })
    }

    // ── Endless / Survival: one wrong (or timeout) ends the run ──────────────
    if (session.endless) {
      const ans = engine.questions[index]?.answer
      // A timeout sends no choice — always a miss (never let Number(null)===0 slip through).
      const isCorrect = choice != null && engine.check(index, choice).correct
      if (!isCorrect) {
        const score = session.mathScores.player
        const roast = getRoastMessage(score >= 10 ? 'correct' : 'lose', totalGames)
        sessions.delete(sessionId)
        return res.json({ success: true, data: { by: 'player', correct: false, answer: ans, scores: { player: score }, next: null, over: true, won: false, endless: true, score, index, roast: roast?.message || null } })
      }
      session.mathScores.player += 1
      session.mathIndex++
      // Generate questions on demand so the run is truly endless.
      while (engine.questions.length <= session.mathIndex) {
        engine.questions.push(MathBattleEngine.makeQuestion(engine.difficulty))
      }
      return res.json({ success: true, data: { by: 'player', correct: true, answer: ans, scores: { player: session.mathScores.player }, next: engine.publicQuestion(session.mathIndex), over: false, endless: true, score: session.mathScores.player, index } })
    }

    const answer = engine.questions[index]?.answer
    let correct = null, aiCorrect = null
    // Scoring: correct = +1 to the answerer. Wrong = −1 to the answerer AND
    // +1 to the opponent (a failed buzz hands the point to the other side).
    if (by === 'ai') {
      aiCorrect = engine.aiAnswersCorrectly()
      if (aiCorrect) session.mathScores.ai += 1
      else { session.mathScores.ai -= 1; session.mathScores.player += 1 }
    } else {
      correct = engine.check(index, choice).correct
      if (correct) session.mathScores.player += 1
      else { session.mathScores.player -= 1; session.mathScores.ai += 1 }
    }

    session.mathIndex++
    const over = session.mathIndex >= engine.total
    const next = over ? null : engine.publicQuestion(session.mathIndex)

    const data = { by, correct, aiCorrect, answer, scores: { ...session.mathScores }, next, over, index }
    if (over) {
      const { player, ai } = session.mathScores
      data.draw = player === ai
      data.won  = !data.draw && player > ai
      const roast = getRoastMessage(data.won ? 'correct' : 'lose', totalGames)
      data.roast = roast?.message || null
      sessions.delete(sessionId)
    }
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// ── Spin Battle (solo) ─────────────────────────────────────────────────────
// All randomness + the answer stay server-side; the client only animates to the
// returned wheel index.
const spinSessionSchema = z.object({ sessionId: z.string(), totalGames: z.number().int().min(0).default(0) })
const spinLetterSchema  = z.object({ sessionId: z.string(), letter: z.string().min(1).max(1), totalGames: z.number().int().min(0).default(0) })
const spinSolveSchema   = z.object({ sessionId: z.string(), attempt: z.string().min(1).max(80), totalGames: z.number().int().min(0).default(0) })

function spinSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || session.mode !== 'SPIN') throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
  return session
}

// Attach an end-of-game roast and clean up the session when a result ends play.
function finishSpin(session, sessionId, result, totalGames) {
  if (result.over) {
    const roast = getRoastMessage(result.won ? 'correct' : 'lose', totalGames)
    result.roast = roast?.message || null
    sessions.delete(sessionId)
  }
  return result
}

gameRouter.post('/spin/spin', (req, res, next) => {
  try {
    const { sessionId } = spinSessionSchema.parse(req.body)
    const session = spinSession(sessionId)
    res.json({ success: true, data: session.engine.spin() })
  } catch (err) { next(err) }
})

gameRouter.post('/spin/guess', (req, res, next) => {
  try {
    const { sessionId, letter, totalGames } = spinLetterSchema.parse(req.body)
    const session = spinSession(sessionId)
    const result = finishSpin(session, sessionId, session.engine.guessConsonant(letter), totalGames)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

gameRouter.post('/spin/vowel', (req, res, next) => {
  try {
    const { sessionId, letter, totalGames } = spinLetterSchema.parse(req.body)
    const session = spinSession(sessionId)
    const result = finishSpin(session, sessionId, session.engine.buyVowel(letter), totalGames)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

gameRouter.post('/spin/solve', (req, res, next) => {
  try {
    const { sessionId, attempt, totalGames } = spinSolveSchema.parse(req.body)
    const session = spinSession(sessionId)
    const result = finishSpin(session, sessionId, session.engine.solve(attempt), totalGames)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── Countdown submit ───────────────────────────────────────────────────────
gameRouter.post('/countdown/submit', (req, res, next) => {
  try {
    const { expression, sessionId, totalGames } = submitSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const result = session.engine.submit(expression)
    if (result.over) sessions.delete(sessionId)
    const roast = result.over ? getRoastMessage(result.won ? 'correct' : 'lose', totalGames) : null
    res.json({ success: true, data: { ...result, roast: roast?.message || null } })
  } catch (err) { next(err) }
})

gameRouter.post('/countdown/timeup', (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const result = session.engine.timeUp()
    sessions.delete(sessionId)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── Number Chain move ──────────────────────────────────────────────────────
gameRouter.post('/chain/move', (req, res, next) => {
  try {
    const { op, operand, sessionId } = moveSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const result = session.engine.applyMove(op, operand)
    if (result.over) sessions.delete(sessionId)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── Number Towers place ────────────────────────────────────────────────────
gameRouter.post('/towers/place', (req, res, next) => {
  try {
    const { slot, sessionId } = placeSchema.parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const result = session.engine.place(slot)
    if (result.over) sessions.delete(sessionId)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

gameRouter.post('/towers/discard', (req, res, next) => {
  try {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body)
    const session = sessions.get(sessionId)
    if (!session) throw createError('Session not found', 404, 'SESSION_NOT_FOUND')
    const result = session.engine.discard()
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── State (any mode) ───────────────────────────────────────────────────────
gameRouter.get('/state/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', status: 404 } })
  const state = session.engine.getState ? session.engine.getState() : {}
  res.json({ success: true, data: { ...state, mode: session.mode } })
})

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
