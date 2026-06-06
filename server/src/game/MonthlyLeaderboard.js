// Monthly MULTIPLAYER leaderboard. Ranked by wins this calendar month; the
// board auto-resets each month (a new YYYY-MM period key = a fresh board).
// Results are recorded server-side at match-end, so clients can't inflate them.
// Persisted to Redis when REDIS_URL is set (survives restarts); in-memory
// otherwise.
import { getRedis } from '../config/redis.js'
import { logger } from '../utils/logger.js'

function monthKey(d = new Date()) { return d.toISOString().slice(0, 7) } // YYYY-MM
const redisKey = (period) => `ns:lb:${period}`

// period -> Map(entrantId -> { entrantId, name, wins, games })
const boards = new Map()

function boardFor(period) {
  if (!boards.has(period)) boards.set(period, new Map())
  return boards.get(period)
}

function sortEntries(map, limit = 100) {
  return [...map.values()]
    .sort((a, b) => b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function recordResult({ entrantId, name, won }) {
  if (!entrantId) return
  const period = monthKey()
  const board = boardFor(period)
  const e = board.get(entrantId) || { entrantId, name: name || 'Player', wins: 0, games: 0 }
  if (name) e.name = name
  e.games += 1
  if (won) e.wins += 1
  board.set(entrantId, e)
  _persist(period)
}

export function getMonthly(limit = 50) {
  const period = monthKey()
  return { period, entries: sortEntries(boardFor(period), limit) }
}

export function getMonthlyRank(entrantId) {
  const sorted = sortEntries(boardFor(monthKey()))
  const idx = sorted.findIndex(e => e.entrantId === entrantId)
  return idx === -1 ? null : idx + 1
}

// ── Redis persistence (best-effort; gated by REDIS_URL) ──────────────────────
function _persist(period) {
  const r = getRedis()
  if (!r) return
  const data = JSON.stringify([...boardFor(period).values()])
  // ~40-day TTL so old months expire on their own
  r.set(redisKey(period), data, 'EX', 60 * 60 * 24 * 40).catch(() => {})
}

async function _load() {
  const r = getRedis()
  if (!r) return
  try {
    const period = monthKey()
    const json = await r.get(redisKey(period))
    if (json) {
      const board = boardFor(period)
      for (const e of JSON.parse(json)) board.set(e.entrantId, e)
      logger.info({ count: board.size, period }, 'Leaderboard restored from Redis')
    }
  } catch (e) {
    logger.warn({ err: e.message }, 'leaderboard load failed')
  }
}
_load()
