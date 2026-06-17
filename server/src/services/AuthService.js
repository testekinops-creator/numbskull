import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../config/prisma.js'
import { levelForXp } from '../game/progression.js'

const SALT_ROUNDS = 12
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

// Refresh tokens stay in memory — they expire and rotate on use
const refreshTokens = new Map()
const lockouts      = new Map()
const MAX_FAILED    = 10
const LOCKOUT_MS    = 15 * 60 * 1000

function accessSecret()  { return process.env.JWT_ACCESS_SECRET  || 'dev_access_secret_change_me' }
function refreshSecret() { return process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me' }

export const AuthService = {

  async register({ email, username, password, guestId }) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    })
    if (existing?.email === email.toLowerCase()) {
      const err = new Error('Email already registered'); err.code = 'EMAIL_EXISTS'; err.status = 409; throw err
    }
    if (existing?.username === username) {
      const err = new Error('Username already taken'); err.code = 'USERNAME_EXISTS'; err.status = 409; throw err
    }

    // Carry over guest progress only if that guestId isn't already linked to an
    // account. The client sends its persistent guest id on every signup, so a
    // guest who already registered once (or creates a 2nd account in the same
    // browser) reuses the same id — linking it again would trip the @unique
    // constraint and fail the whole signup. In that case we just skip the link.
    let linkGuestId = null
    if (guestId) {
      const claimed = await prisma.user.findUnique({ where: { guestId } })
      if (!claimed) linkGuestId = guestId
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    try {
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          passwordHash,
          role: 'user',
          guestId: linkGuestId,
        },
      })
      return this._tokenPair(user)
    } catch (err) {
      // Defensive: a concurrent signup could still trip a unique constraint.
      if (err.code === 'P2002') {
        const field = Array.isArray(err.meta?.target) ? err.meta.target[0] : String(err.meta?.target || '')
        if (field.includes('guestId')) {
          // The only clash is the guest link — retry the signup without it.
          const user = await prisma.user.create({
            data: { email: email.toLowerCase(), username, passwordHash, role: 'user', guestId: null },
          })
          return this._tokenPair(user)
        }
        const isEmail = field.includes('email')
        const e = new Error(isEmail ? 'Email already registered' : 'Username already taken')
        e.code = isEmail ? 'EMAIL_EXISTS' : 'USERNAME_EXISTS'; e.status = 409; throw e
      }
      throw err
    }
  },

  async login({ email, password }) {
    // Find by email OR username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: { equals: email, mode: 'insensitive' } },
        ],
      },
    })

    const lockKey = email.toLowerCase()
    const lock    = lockouts.get(lockKey)
    if (lock && Date.now() < lock) {
      const err = new Error('Account locked. Try again in 15 minutes.'); err.code = 'ACCOUNT_LOCKED'; err.status = 429; throw err
    }

    if (!user || !user.passwordHash) {
      await bcrypt.hash('dummy', 8)
      const err = new Error('Invalid credentials'); err.code = 'INVALID_CREDENTIALS'; err.status = 401; throw err
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      const fails = (user.failedLogins || 0) + 1
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails } })
      if (fails >= MAX_FAILED) lockouts.set(lockKey, Date.now() + LOCKOUT_MS)
      const err = new Error('Invalid credentials'); err.code = 'INVALID_CREDENTIALS'; err.status = 401; throw err
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } })
    lockouts.delete(lockKey)
    return this._tokenPair(user)
  },

  async refresh(token) {
    let payload
    try { payload = jwt.verify(token, refreshSecret()) }
    catch { const err = new Error('Invalid refresh token'); err.code = 'INVALID_TOKEN'; err.status = 401; throw err }

    const stored = refreshTokens.get(payload.jti)
    if (!stored || stored !== token) {
      const err = new Error('Refresh token reuse detected'); err.code = 'TOKEN_REUSE'; err.status = 401; throw err
    }
    refreshTokens.delete(payload.jti)

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) { const err = new Error('User not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err }
    return this._tokenPair(user)
  },

  async logout(token) {
    try {
      const payload = jwt.decode(token)
      if (payload?.jti) refreshTokens.delete(payload.jti)
    } catch {}
  },

  verifyAccess(token) {
    return jwt.verify(token, accessSecret())
  },

  async getUser(id) {
    return prisma.user.findUnique({ where: { id } })
  },

  async getUserByEmail(email) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  },

  async searchUsers(query, excludeId) {
    if (!query || query.length < 2) return []
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: excludeId } },
          { deleted: { not: true } },
          { banned: { not: true } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
    })
    return users.map(u => this.publicProfile(u))
  },

  async updateUser(id, patch) {
    return prisma.user.update({ where: { id }, data: patch })
  },

  // Social sign-in (Google / Facebook). The route has already VERIFIED the
  // provider token and the email; here we just find-or-create by that verified
  // email and issue our own tokens — no password (OAuth-only) account.
  async oauthLogin({ email, name, guestId }) {
    if (!email) { const e = new Error('No email from provider'); e.code = 'OAUTH_EMAIL'; e.status = 400; throw e }
    const lower = email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email: lower } })
    if (existing) {
      if (existing.banned) { const e = new Error('Account banned'); e.code = 'BANNED'; e.status = 403; throw e }
      return this._tokenPair(existing)
    }
    // New account linked to the verified email.
    let linkGuestId = null
    if (guestId) {
      const claimed = await prisma.user.findUnique({ where: { guestId } })
      if (!claimed) linkGuestId = guestId
    }
    const base = name || lower.split('@')[0]
    try {
      const user = await prisma.user.create({
        data: { email: lower, username: await this._uniqueUsername(base), role: 'user', guestId: linkGuestId },
      })
      return this._tokenPair(user)
    } catch (err) {
      // A concurrent signup or username/guest clash → retry with a fresh username, no guest link.
      if (err.code === 'P2002') {
        const user = await prisma.user.create({
          data: { email: lower, username: await this._uniqueUsername(base, true), role: 'user', guestId: null },
        })
        return this._tokenPair(user)
      }
      throw err
    }
  },

  // Derive a unique username (2–20 chars, [A-Za-z0-9_-]) from a display name/email.
  async _uniqueUsername(base, forceSuffix = false) {
    let s = String(base || 'player').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 14)
    if (s.length < 2) s = 'player'
    let candidate = forceSuffix ? `${s}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20) : s
    for (let i = 0; i < 8; i++) {
      const taken = await prisma.user.findUnique({ where: { username: candidate } })
      if (!taken) return candidate
      candidate = `${s}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 20)
    }
    return `${s}${Date.now().toString().slice(-6)}`.slice(0, 20)
  },

  publicProfile(user) {
    if (!user) return null
    return {
      id:         user.id,
      username:   user.username,
      role:       user.role,
      totalGames: user.totalGames,
      gtnWins:    user.gtnWins,
      bcWins:     user.bcWins,
      xoxWins:    user.xoxWins    ?? 0,
      mathWins:   user.mathWins   ?? 0,
      sudokuWins: user.sudokuWins ?? 0,
      rummyWins:  user.rummyWins  ?? 0,
      queensWins: user.queensWins ?? 0,
      xp:         user.xp ?? 0,
      level:      levelForXp(user.xp ?? 0),
      coins:      user.coins ?? 0,
      equippedFrame: user.equippedFrame ?? null,
      equippedTitle: user.equippedTitle ?? null,
      createdAt:  user.createdAt,
    }
  },

  _tokenPair(user) {
    const jti = uuidv4()
    const accessToken  = jwt.sign({ sub: user.id, role: user.role }, accessSecret(),  { expiresIn: ACCESS_EXPIRES })
    const refreshToken = jwt.sign({ sub: user.id, jti },             refreshSecret(), { expiresIn: REFRESH_EXPIRES })
    refreshTokens.set(jti, refreshToken)
    return { accessToken, refreshToken, user: this.publicProfile(user) }
  },
}
