import { Router } from 'express'
import { z } from 'zod'
import { engineFactory, VALID_MODES } from '../game/engineFactory.js'
import { getRoastMessage } from '../game/personality.js'
import { getActiveEvent, applyEventModifier } from '../game/SeasonalEvents.js'
import { createError } from '../middleware/errorHandler.js'

export const gameRouter = Router()

const startSchema = z.object({
  mode:       z.enum(VALID_MODES),
  difficulty: z.enum(['easy', 'medium', 'hard', 'adaptive']).default('medium'),
  range:      z.number().int().positive().optional(),
  totalGames: z.number().int().min(0).default(0),
  largeCount: z.number().int().min(0).max(4).optional(),
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
    const { mode, difficulty, range, largeCount } = startSchema.parse(req.body)
    const event    = getActiveEvent()
    const baseOpts = { difficulty, range, largeCount }
    const opts     = applyEventModifier(baseOpts, event)
    const engine   = engineFactory(mode, opts)
    const sessionId = uid()
    sessions.set(sessionId, { engine, mode, event: event?.id || null })
    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000)

    const state = engine.getState ? engine.getState() : {}
    res.json({ success: true, data: { sessionId, mode, range: engine.range, event: event?.id || null, ...state } })
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
