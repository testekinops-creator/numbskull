import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../config/prisma.js'

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

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
        role: 'user',
        guestId: guestId || null,
      },
    })
    return this._tokenPair(user)
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

  publicProfile(user) {
    if (!user) return null
    return {
      id:         user.id,
      username:   user.username,
      role:       user.role,
      totalGames: user.totalGames,
      gtnWins:    user.gtnWins,
      bcWins:     user.bcWins,
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
