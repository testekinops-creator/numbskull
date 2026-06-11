import { roomManager } from './RoomManager.js'
import { logger } from '../utils/logger.js'

// How long we remember who you last played, to avoid immediately re-pairing the
// same two people when other opponents are waiting.
const RECENT_TTL_MS = 5 * 60_000

// Modes that need more than 2 players grouped before a match can start. Raja
// Mantri is exactly 4; everything else is a 1v1 pairing.
const GROUP_SIZE = { RMCS: 4 }

export class QuickMatchQueue {
  constructor() {
    this._queue = []
    this._recent = new Map()  // accountKey -> { opp: accountKey, ts }
  }

  // `key` is an account-stable identity (userId when registered, else playerId)
  // so the same account on two devices can't self-match or double-queue.
  async enqueue(playerId, playerName, mode = 'GTN', difficulty = 'medium', key = null, avatar = null) {
    const myKey = key || playerId
    const need = GROUP_SIZE[mode] || 2

    // Idempotent: already waiting (same socket OR same account) → stay waiting.
    if (this._queue.find(e => e.playerId === playerId || e.key === myKey)) {
      return { matched: false, roomId: null, waiting: true }
    }

    const me = { playerId, playerName, avatar, mode, difficulty, key: myKey }

    // ── Group modes (e.g. Raja Mantri = 4): gather enough distinct waiting
    //    players of this mode, then open ONE party room with all of them. ──
    if (need > 2) {
      const mates = this._queue.filter(e => e.mode === mode && e.key !== myKey)
      if (mates.length < need - 1) {
        this._queue.push({ ...me, enqueuedAt: Date.now() })
        return { matched: false, roomId: null, waiting: true }
      }
      const chosen = mates.slice(0, need - 1)           // longest-waiting first
      for (const m of chosen) this._queue.splice(this._queue.indexOf(m), 1)
      const members = [...chosen, me]                   // host = first (longest-waiting)
      const host = members[0]
      const room = await roomManager.create({
        hostId: host.playerId,
        hostName: host.playerName,
        hostAvatar: host.avatar || null,
        mode,
        difficulty: host.difficulty || difficulty,
        isPublic: false,
        maxPlayers: need,
      })
      await roomManager.update(room.id, r => {
        for (const m of members.slice(1)) {
          r.players.push({ id: m.playerId, name: m.playerName, avatar: m.avatar || null, ready: false, score: 0 })
        }
        r.phase = 'LOBBY'   // party room: the host presses Start when everyone's in
      })
      logger.debug({ roomId: room.id, mode, size: need }, 'Quick match grouped')
      return { matched: true, roomId: room.id, room: await roomManager.get(room.id), memberIds: members.map(m => m.playerId) }
    }

    // ── 1v1 modes: pair with the best available opponent. ──
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
        hostAvatar: opponent.avatar || null,
        mode,
        // The waiting player "hosted" the match → use their chosen difficulty.
        difficulty: opponent.difficulty || difficulty,
        isPublic: false,
      })
      await roomManager.update(room.id, r => {
        r.players.push({ id: playerId, name: playerName, avatar: avatar || null, ready: false, score: 0 })
        r.phase = 'SETUP'
      })
      logger.debug({ roomId: room.id, mode }, 'Quick match paired')
      return { matched: true, roomId: room.id, room: await roomManager.get(room.id), opponentId: opponent.playerId }
    }

    this._queue.push({ ...me, enqueuedAt: Date.now() })
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
