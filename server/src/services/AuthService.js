import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const SALT_ROUNDS = 12
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

const users     = new Map()
const byEmail   = new Map()
const byGuest   = new Map()
const refreshTokens = new Map()
const lockouts  = new Map()

const MAX_FAILED = 10
const LOCKOUT_MS = 15 * 60 * 1000

function accessSecret()  { return process.env.JWT_ACCESS_SECRET  || 'dev_access_secret_change_me' }
function refreshSecret() { return process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me' }

export const AuthService = {
  async register({ email, username, password, guestId }) {
    if (byEmail.has(email.toLowerCase())) {
      const err = new Error('Email already registered'); err.code = 'EMAIL_EXISTS'; err.status = 409; throw err
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const user = {
      id: uuidv4(), email: email.toLowerCase(), username, passwordHash,
      role: 'user', totalGames: 0, gtnWins: 0, bcWins: 0,
      guestId: guestId || null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      failedLogins: 0, lockedUntil: null,
    }
    users.set(user.id, user)
    byEmail.set(user.email, user.id)
    if (guestId) byGuest.set(guestId, user.id)
    return this._tokenPair(user)
  },

  async login({ email, password }) {
    // Support login with email OR username
    let userId = byEmail.get(email.toLowerCase())
    if (!userId) {
      // Try matching by username (case-insensitive)
      for (const u of users.values()) {
        if (u.username?.toLowerCase() === email.toLowerCase()) {
          userId = u.id
          break
        }
      }
    }
    const user = userId ? users.get(userId) : null

    const lockKey = email.toLowerCase()
    const lock = lockouts.get(lockKey)
    if (lock && Date.now() < lock) {
      const err = new Error('Account locked. Try again in 15 minutes.'); err.code = 'ACCOUNT_LOCKED'; err.status = 429; throw err
    }

    if (!user || !user.passwordHash) {
      await bcrypt.hash('dummy', 8)
      const err = new Error('Invalid credentials'); err.code = 'INVALID_CREDENTIALS'; err.status = 401; throw err
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      user.failedLogins = (user.failedLogins || 0) + 1
      if (user.failedLogins >= MAX_FAILED) lockouts.set(lockKey, Date.now() + LOCKOUT_MS)
      const err = new Error('Invalid credentials'); err.code = 'INVALID_CREDENTIALS'; err.status = 401; throw err
    }

    user.failedLogins = 0
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

    const user = users.get(payload.sub)
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

  getUser(id) { return users.get(id) || null },

  getUserByEmail(email) {
    const id = byEmail.get(email.toLowerCase())
    return id ? users.get(id) : null
  },

  searchUsers(query, excludeId) {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()
    const results = []
    for (const user of users.values()) {
      if (user.id === excludeId) continue
      if (user.deleted || user.banned) continue
      if (user.username?.toLowerCase().includes(q)) {
        results.push(this.publicProfile(user))
      }
      if (results.length >= 10) break
    }
    return results
  },

  updateUser(id, patch) {
    const user = users.get(id)
    if (!user) return null
    Object.assign(user, patch, { updatedAt: new Date().toISOString() })
    return user
  },

  publicProfile(user) {
    if (!user) return null
    return { id: user.id, username: user.username, role: user.role, totalGames: user.totalGames, gtnWins: user.gtnWins, bcWins: user.bcWins, createdAt: user.createdAt }
  },

  _tokenPair(user) {
    const jti = uuidv4()
    const accessToken = jwt.sign({ sub: user.id, role: user.role }, accessSecret(), { expiresIn: ACCESS_EXPIRES })
    const refreshToken = jwt.sign({ sub: user.id, jti }, refreshSecret(), { expiresIn: REFRESH_EXPIRES })
    refreshTokens.set(jti, refreshToken)
    return { accessToken, refreshToken, user: this.publicProfile(user) }
  },
}
