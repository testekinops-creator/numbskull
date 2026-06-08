import { roomManager } from './RoomManager.js'
import { logger } from '../utils/logger.js'

// How long we remember who you last played, to avoid immediately re-pairing the
// same two people when other opponents are waiting.
const RECENT_TTL_MS = 5 * 60_000

export class QuickMatchQueue {
  constructor() {
    this._queue = []
    this._recent = new Map()  // accountKey -> { opp: accountKey, ts }
  }

  // `key` is an account-stable identity (userId when registered, else playerId)
  // so the same account on two devices can't self-match or double-queue.
  async enqueue(playerId, playerName, mode = 'GTN', difficulty = 'medium', key = null) {
    const myKey = key || playerId

    // Idempotent: already waiting (same socket OR same account) → stay waiting.
    if (this._queue.find(e => e.playerId === playerId || e.key === myKey)) {
      return { matched: false, roomId: null, waiting: true }
    }

    // Candidates: same mode, NOT my own account. Prefer someone who isn't the
    // opponent I just played (fairness); fall back to anyone if that's all there is.
    const candidates = this._queue.filter(e => e.mode === mode && e.key !== myKey)
    const lastOpp = this._recentOpp(myKey)
    const opponent = candidates.find(e => e.key !== lastOpp) || candidates[0]

    if (opponent) {
      this._queue.splice(this._queue.indexOf(opponent), 1)
      this._remember(myKey, opponent.key)
      this._remember(opponent.key, myKey)
      const room = await roomManager.create({
        hostId: opponent.playerId,
        hostName: opponent.playerName,
        mode,
        // The waiting player "hosted" the match → use their chosen difficulty.
        difficulty: opponent.difficulty || difficulty,
        isPublic: false,
      })
      await roomManager.update(room.id, r => {
        r.players.push({ id: playerId, name: playerName, ready: false, score: 0 })
        r.phase = 'SETUP'
      })
      logger.debug({ roomId: room.id, mode }, 'Quick match paired')
      return { matched: true, roomId: room.id, room: await roomManager.get(room.id), opponentId: opponent.playerId }
    }

    this._queue.push({ playerId, playerName, mode, difficulty, key: myKey, enqueuedAt: Date.now() })
    return { matched: false, roomId: null, waiting: true }
  }

  dequeue(playerId) {
    const idx = this._queue.findIndex(e => e.playerId === playerId)
    if (idx !== -1) this._queue.splice(idx, 1)
  }

  // Drop entries whose player is no longer connected (closed-tab ghosts), so
  // nobody "matches" with someone who has left the queue.
  prune(isAlive) {
    this._queue = this._queue.filter(e => isAlive(e.playerId))
  }

  isQueued(playerId) {
    return this._queue.some(e => e.playerId === playerId)
  }

  _recentOpp(key) {
    const r = this._recent.get(key)
    if (!r) return null
    if (Date.now() - r.ts > RECENT_TTL_MS) { this._recent.delete(key); return null }
    return r.opp
  }

  _remember(key, opp) {
    this._recent.set(key, { opp, ts: Date.now() })
    // Opportunistic TTL cleanup so the map can't grow unbounded.
    if (this._recent.size > 500) {
      const cutoff = Date.now() - RECENT_TTL_MS
      for (const [k, v] of this._recent) if (v.ts < cutoff) this._recent.delete(k)
    }
  }

  get size() { return this._queue.length }
}

export const quickMatch = new QuickMatchQueue()
