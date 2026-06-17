import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import { getRedis } from '../config/redis.js'

const ROOM_TTL_MS = 10 * 60 * 1000
const REDIS_TTL_S = Math.floor(ROOM_TTL_MS / 1000)
const MAX_ROOMS = 5000
const ROOM_CODE_LEN = 6

const ROOMS_SET = 'ns:rooms'
const roomKey = (id) => `ns:room:${id}`
const codeKey = (c)  => `ns:code:${c}`

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export class RoomManager {
  constructor() {
    this._rooms = new Map()
    this._byCode = new Map()
    this._locks = new Map()
    setInterval(() => this._evict(), 60_000)
    this._loadFromRedis()  // no-op unless REDIS_URL is set
  }

  // ── Redis mirror (best-effort; survives restarts when REDIS_URL is set) ────
  _persist(room) {
    const r = getRedis()
    if (!r || !room) return
    const json = JSON.stringify(room)
    r.multi()
      .set(roomKey(room.id), json, 'EX', REDIS_TTL_S)
      .set(codeKey(room.code), room.id, 'EX', REDIS_TTL_S)
      .sadd(ROOMS_SET, room.id)
      .exec()
      .catch(e => logger.warn({ err: e.message }, 'room persist failed'))
  }

  _unpersist(room) {
    const r = getRedis()
    if (!r || !room) return
    r.multi()
      .del(roomKey(room.id))
      .del(codeKey(room.code))
      .srem(ROOMS_SET, room.id)
      .exec()
      .catch(() => {})
  }

  async _loadFromRedis() {
    const r = getRedis()
    if (!r) return
    try {
      const ids = await r.smembers(ROOMS_SET)
      for (const id of ids) {
        const json = await r.get(roomKey(id))
        if (!json) { r.srem(ROOMS_SET, id).catch(() => {}); continue }
        const room = JSON.parse(json)
        this._rooms.set(room.id, room)
        this._byCode.set(room.code, room.id)
      }
      if (this._rooms.size) logger.info({ count: this._rooms.size }, 'Rooms restored from Redis')
    } catch (e) {
      logger.warn({ err: e.message }, 'room reload failed')
    }
  }

  // ── Locking (simple async mutex per room) ─────────────────────────────────
  async _lock(roomId) {
    while (this._locks.get(roomId)) {
      await new Promise(r => setTimeout(r, 2))
    }
    this._locks.set(roomId, true)
  }
  _unlock(roomId) { this._locks.delete(roomId) }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async create({ hostId, hostName, hostAvatar = null, mode = 'GTN', difficulty = 'medium', isPublic = true, maxPlayers = 2 }) {
    if (this._rooms.size >= MAX_ROOMS) {
      throw new Error('Server is at room capacity')
    }
    let code
    do { code = genCode() } while (this._byCode.has(code))

    const room = {
      id: uuidv4(),
      code,
      hostId,
      mode,
      difficulty,
      isPublic,
      maxPlayers: Math.max(2, Math.min(8, maxPlayers | 0)),  // party rooms: 2–8
      phase: 'LOBBY',        // LOBBY | SETUP | PLAYING | ROUND_OVER | GAME_OVER
      players: [{ id: hostId, name: hostName, avatar: hostAvatar ?? null, ready: false, score: 0 }],
      spectators: [],
      round: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this._rooms.set(room.id, room)
    this._byCode.set(code, room.id)
    this._persist(room)
    logger.debug({ roomId: room.id, code }, 'Room created')
    return room
  }

  async get(roomId) { return this._rooms.get(roomId) || null }

  async getByCode(code) {
    const id = this._byCode.get(code.toUpperCase())
    return id ? this._rooms.get(id) || null : null
  }

  async update(roomId, fn) {
    await this._lock(roomId)
    try {
      const room = this._rooms.get(roomId)
      if (!room) return null
      fn(room)
      room.updatedAt = Date.now()
      this._persist(room)
      return room
    } finally {
      this._unlock(roomId)
    }
  }

  async delete(roomId) {
    const room = this._rooms.get(roomId)
    if (room) {
      this._byCode.delete(room.code)
      this._rooms.delete(roomId)
      this._unpersist(room)
    }
  }

  listPublic() {
    return [...this._rooms.values()]
      .filter(r => r.isPublic && r.phase === 'LOBBY' && r.players.length < 2)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
  }

  // Synchronous in-memory peek (no Redis round-trip) — for fast presence/watch checks.
  peek(id) { return this._rooms.get(id) || null }

  // In-progress games (for the friends watch list). Newest first.
  playingRooms() {
    return [...this._rooms.values()]
      .filter(r => r.phase === 'PLAYING')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 40)
  }

  _evict() {
    const now = Date.now()
    for (const [id, room] of this._rooms) {
      if (now - room.updatedAt > ROOM_TTL_MS) {
        this._byCode.delete(room.code)
        this._rooms.delete(id)
        this._unpersist(room)
        logger.debug({ roomId: id }, 'Room evicted (TTL)')
      }
    }
  }
}

export const roomManager = new RoomManager()
