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
    res.status(201).json({ success: true, data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user } })
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
    res.json({ success: true, data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user } })
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
    // Also send refreshToken in body for cross-origin clients (localStorage)
    res.json({ success: true, data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user } })
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
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.userId)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
    res.json({ success: true, data: { user: AuthService.publicProfile(user) } })
  } catch (err) { next(err) }
})

const oauthError = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message, status } })

// ── Google sign-in ──────────────────────────────────────────────────────────
// Accepts either a GIS ID token (`credential`) OR an OAuth2 access token
// (`accessToken`, from the custom-button token flow). Both are verified against
// Google's tokeninfo with an AUDIENCE check (so a token minted for another app
// can't log in here). Activates only when GOOGLE_CLIENT_ID is set.
authRouter.post('/google', authLimiter, async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) return oauthError(res, 501, 'NOT_CONFIGURED', 'Google sign-in is not configured')
    const { credential, accessToken, guestId } = req.body || {}

    let email, emailVerified, name
    if (credential) {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
      if (!r.ok) return oauthError(res, 401, 'OAUTH_INVALID', 'Could not verify Google sign-in')
      const p = await r.json()
      const issOk = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com'
      if (!issOk || p.aud !== clientId) return oauthError(res, 401, 'OAUTH_INVALID', 'Google token rejected')
      email = p.email; emailVerified = p.email_verified; name = p.name || p.given_name
    } else if (accessToken) {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
      if (!r.ok) return oauthError(res, 401, 'OAUTH_INVALID', 'Could not verify Google sign-in')
      const p = await r.json()
      if (p.aud !== clientId && p.azp !== clientId) return oauthError(res, 401, 'OAUTH_INVALID', 'Google token rejected')
      email = p.email; emailVerified = p.email_verified
      // tokeninfo may omit the name → grab it (and email as a fallback) from userinfo.
      try {
        const u = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
        if (u.ok) { const uj = await u.json(); name = uj.name || uj.given_name; email = email || uj.email; if (emailVerified == null) emailVerified = uj.email_verified }
      } catch { /* userinfo is best-effort */ }
    } else {
      return oauthError(res, 400, 'BAD_REQUEST', 'Missing Google token')
    }

    if (emailVerified !== true && emailVerified !== 'true') return oauthError(res, 401, 'OAUTH_EMAIL', 'Google email not verified')
    const result = await AuthService.oauthLogin({ email, name, guestId })
    _setRefreshCookie(res, result.refreshToken)
    res.json({ success: true, data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user } })
  } catch (err) { next(err) }
})

// ── Facebook sign-in ──────────────────────────────────────────────────────────
// Client sends a FB access token. We validate it (debug_token with our app
// secret), pull the verified email, then find-or-create. Activates only when
// FACEBOOK_APP_ID + FACEBOOK_APP_SECRET are set.
authRouter.post('/facebook', authLimiter, async (req, res, next) => {
  try {
    const appId = process.env.FACEBOOK_APP_ID
    const appSecret = process.env.FACEBOOK_APP_SECRET
    if (!appId || !appSecret) return oauthError(res, 501, 'NOT_CONFIGURED', 'Facebook sign-in is not configured')
    const { accessToken, guestId } = req.body || {}
    if (!accessToken) return oauthError(res, 400, 'BAD_REQUEST', 'Missing Facebook access token')

    // 1) Validate the token belongs to our app and is live.
    const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${appId}|${appSecret}`)
    const dbgJson = await dbg.json().catch(() => ({}))
    const d = dbgJson?.data
    if (!d?.is_valid || String(d.app_id) !== String(appId)) return oauthError(res, 401, 'OAUTH_INVALID', 'Facebook token rejected')

    // 2) Pull the profile (email needs the `email` permission / app review).
    const me = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`)
    const prof = await me.json().catch(() => ({}))
    if (!prof.email) return oauthError(res, 400, 'OAUTH_EMAIL', 'Facebook didn’t share an email — try Google or email signup')

    const result = await AuthService.oauthLogin({ email: prof.email, name: prof.name, guestId })
    _setRefreshCookie(res, result.refreshToken)
    res.json({ success: true, data: { accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user } })
  } catch (err) { next(err) }
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
