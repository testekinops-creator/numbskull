import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'

const ROOM_TTL_MS = 10 * 60 * 1000
const MAX_ROOMS = 5000
const ROOM_CODE_LEN = 6

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
  async create({ hostId, hostName, mode = 'GTN', difficulty = 'medium', isPublic = true }) {
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
      phase: 'LOBBY',        // LOBBY | SETUP | PLAYING | ROUND_OVER | GAME_OVER
      players: [{ id: hostId, name: hostName, ready: false, score: 0 }],
      spectators: [],
      round: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this._rooms.set(room.id, room)
    this._byCode.set(code, room.id)
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
    }
  }

  listPublic() {
    return [...this._rooms.values()]
      .filter(r => r.isPublic && r.phase === 'LOBBY' && r.players.length < 2)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
  }

  _evict() {
    const now = Date.now()
    for (const [id, room] of this._rooms) {
      if (now - room.updatedAt > ROOM_TTL_MS) {
        this._byCode.delete(room.code)
        this._rooms.delete(id)
        logger.debug({ roomId: id }, 'Room evicted (TTL)')
      }
    }
  }
}

export const roomManager = new RoomManager()
