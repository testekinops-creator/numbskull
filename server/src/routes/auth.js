import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { AuthService } from '../services/AuthService.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false })

const registerSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, _ and - only'),
  password: z.string().min(8).max(128),
  guestId:  z.string().optional(),
})

// Accept email address OR username in the email field
const loginSchema = z.object({
  email:    z.string().min(1),
  password: z.string().min(1),
})

// ── Guest session ──────────────────────────────────────────────────────────
authRouter.post('/guest', (_req, res) => {
  const guestId = `guest_${uuidv4()}`
  res.json({ success: true, data: { guestId, role: 'guest' } })
})

// ── Register ───────────────────────────────────────────────────────────────
authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)
    const result = await AuthService.register(body)
    _setRefreshCookie(res, result.refreshToken)
    res.status(201).json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Invalid input', status: 400 } })
    next(err)
  }
})

// ── Login ──────────────────────────────────────────────────────────────────
authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const result = await AuthService.login({ email, password })
    _setRefreshCookie(res, result.refreshToken)
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', status: 400 } })
    next(err)
  }
})

// ── Refresh ────────────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken
    if (!token) return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'No refresh token', status: 401 } })
    const result = await AuthService.refresh(token)
    _setRefreshCookie(res, result.refreshToken)
    res.json({ success: true, data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) {
    next(err)
  }
})

// ── Logout ─────────────────────────────────────────────────────────────────
authRouter.post('/logout', requireAuth, async (req, res) => {
  const token = req.cookies?.refreshToken
  if (token) await AuthService.logout(token)
  res.clearCookie('refreshToken')
  res.json({ success: true, data: null })
})

// ── Me ─────────────────────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, (req, res) => {
  const user = AuthService.getUser(req.userId)
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
  res.json({ success: true, data: { user: AuthService.publicProfile(user) } })
})

// ── Google OAuth stub ──────────────────────────────────────────────────────
authRouter.get('/google', (_req, res) => {
  res.json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Google OAuth coming soon', status: 501 } })
})

function _setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  })
}
