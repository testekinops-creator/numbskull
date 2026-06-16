import webpush from 'web-push'
import { logger } from '../utils/logger.js'
import { getRedis } from '../config/redis.js'
import { AuthService } from './AuthService.js'

// In-memory mirror of subscriptions (fast path); the source of truth is Redis
// when REDIS_URL is set, so subscriptions + the daily re-engagement job survive
// restarts and work across instances. Falls back to in-memory-only otherwise.
const subscriptions = new Map()   // userId -> subscription
const SUB_KEY  = (uid) => `push:sub:${uid}`
const SUBS_SET = 'push:subs'      // Redis SET of subscribed userIds

let vapidReady = false

function init() {
  const publicKey  = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email      = process.env.VAPID_EMAIL || 'mailto:admin@numbskull.app'

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey)
    vapidReady = true
    logger.info('Web Push VAPID configured')
    startDailyReengagement()
  } else {
    logger.warn('VAPID keys not set — push notifications disabled')
  }
}

// ── Per-game notification content ─────────────────────────────────────────────
// Each game gets its OWN copy + deep-links straight into that game's lobby
// (LobbyPage reads ?mode=). Keyed by the same mode strings used everywhere.
const GAME_PUSH = {
  GTN:    { emoji: '🎯', name: 'Guess The Number', hook: "A rival's secret number is begging to be cracked. One quick duel?" },
  BC:     { emoji: '🐂', name: 'Bulls & Cows',     hook: 'Got a code-breaking itch? Bulls hit, cows tease — come solve one.' },
  XOX:    { emoji: '⭕', name: 'Tic-Tac-Toe',      hook: 'Three in a row in 30 seconds flat. Quick match?' },
  MATH:   { emoji: '🧮', name: 'Math Battle',      hook: 'Fast hands, faster math. Buzz in before your rival does!' },
  SUDOKU: { emoji: '🔢', name: 'Sudoku',           hook: 'A fresh grid is waiting to be claimed — solo or duel.' },
  SPIN:   { emoji: '🎡', name: 'Spin Battle',      hook: 'Spin the wheel, call a letter, solve the phrase. Your turn!' },
  SOS:    { emoji: '🔠', name: 'SOS',              hook: 'Spell S‑O‑S, draw the line, take the board. Game on?' },
  RMCS:   { emoji: '👑', name: 'Raja Mantri',      hook: 'The court is assembling — read faces and catch the Chor.' },
  RUMMY:  { emoji: '🃏', name: 'Rummy',            hook: 'Your Rummy table is waiting — deal you in for a hand?' },
}
// Win-counter field on the User row for each mode we can rank by.
const WIN_FIELD = {
  GTN: 'gtnWins', BC: 'bcWins', XOX: 'xoxWins',
  MATH: 'mathWins', SUDOKU: 'sudokuWins', RUMMY: 'rummyWins',
}
const GENERIC = { title: '🎮 Numbskull misses you', body: 'Your daily brain-duel is one tap away. Come play a round!', url: '/home', tag: 'reengage-generic' }

// The mode a player has won most (a stand-in for "played most"); null if they've
// never won anything we track.
export function favoriteMode(user) {
  let best = null, max = 0
  for (const [mode, field] of Object.entries(WIN_FIELD)) {
    const n = user?.[field] || 0
    if (n > max) { max = n; best = mode }
  }
  return best
}

// The personalised notification payload for a user, based on their favourite game.
export function notificationFor(user) {
  const mode = favoriteMode(user)
  if (!mode) return GENERIC
  const g = GAME_PUSH[mode]
  return {
    title: `${g.emoji} ${g.name} is calling`,
    body:  g.hook,
    url:   `/lobby?mode=${mode}`,   // deep-link straight into that game's lobby
    tag:   `reengage-${mode}`,
  }
}

async function _redis() { return getRedis() }

export const PushService = {
  vapidReady: () => vapidReady,

  async subscribe(userId, subscription) {
    subscriptions.set(userId, subscription)
    const r = await _redis()
    if (r) {
      try { await r.set(SUB_KEY(userId), JSON.stringify(subscription)); await r.sadd(SUBS_SET, userId) }
      catch (err) { logger.warn({ err: err.message }, 'push subscribe redis write failed') }
    }
  },

  async unsubscribe(userId) {
    subscriptions.delete(userId)
    const r = await _redis()
    if (r) {
      try { await r.del(SUB_KEY(userId)); await r.srem(SUBS_SET, userId) }
      catch (err) { logger.warn({ err: err.message }, 'push unsubscribe redis write failed') }
    }
  },

  async _getSub(userId) {
    if (subscriptions.has(userId)) return subscriptions.get(userId)
    const r = await _redis()
    if (r) {
      try {
        const s = await r.get(SUB_KEY(userId))
        if (s) { const sub = JSON.parse(s); subscriptions.set(userId, sub); return sub }
      } catch (err) { logger.warn({ err: err.message }, 'push sub redis read failed') }
    }
    return null
  },

  async _allSubscriberIds() {
    const r = await _redis()
    if (r) { try { return await r.smembers(SUBS_SET) } catch { /* fall through */ } }
    return [...subscriptions.keys()]
  },

  async sendToUser(userId, { title, body, url, tag }) {
    if (!vapidReady) return false
    const sub = await this._getSub(userId)
    if (!sub) return false
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url, tag }))
      return true
    } catch (err) {
      // 404/410 = the subscription is dead (browser unsubscribed) → prune it.
      if (err.statusCode === 404 || err.statusCode === 410) await this.unsubscribe(userId)
      else logger.warn({ err: err.message, userId }, 'Push notification failed')
      return false
    }
  },

  // Send each subscriber a notification for THEIR most-played game. By default
  // only nudges players who haven't been active in the last `inactiveHours`
  // (so we never nag someone mid-session). Returns how many were sent.
  async sendReengagement({ inactiveHours = 24 } = {}) {
    if (!vapidReady) return 0
    const ids = await this._allSubscriberIds()
    const cutoff = Date.now() - inactiveHours * 3_600_000
    let sent = 0
    for (const userId of ids) {
      try {
        const user = await AuthService.getUser(userId)
        if (!user) { await this.unsubscribe(userId); continue }   // account gone → drop sub
        const lastActive = new Date(user.updatedAt || user.createdAt || 0).getTime()
        if (lastActive > cutoff) continue                          // played recently → skip
        const ok = await this.sendToUser(userId, notificationFor(user))
        if (ok) sent++
      } catch (err) { logger.warn({ err: err.message, userId }, 'reengagement send failed') }
    }
    logger.info({ sent, considered: ids.length }, 'Push re-engagement run complete')
    return sent
  },
}

// ── Daily scheduler ──────────────────────────────────────────────────────────
// Fires once a day at ~18:00 server-local. Single-process timer (the server runs
// 24/7); guarded so it only runs when VAPID is configured.
let dailyTimer = null
function startDailyReengagement() {
  if (dailyTimer) return
  const scheduleNext = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(18, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    dailyTimer = setTimeout(async () => {
      try { await PushService.sendReengagement() }
      catch (err) { logger.error({ err }, 'daily re-engagement error') }
      scheduleNext()
    }, next - now)
    if (dailyTimer.unref) dailyTimer.unref()   // don't keep the process alive just for this
  }
  scheduleNext()
  logger.info('Push daily re-engagement scheduler armed (18:00)')
}

init()
