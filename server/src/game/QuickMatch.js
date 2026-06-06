import { roomManager } from './RoomManager.js'
import { logger } from '../utils/logger.js'

export class QuickMatchQueue {
  constructor() {
    this._queue = []
  }

  async enqueue(playerId, playerName, mode = 'GTN', difficulty = 'medium') {
    const existing = this._queue.find(e => e.playerId === playerId)
    if (existing) return { matched: false, roomId: null, waiting: true }

    const opponent = this._queue.find(e => e.mode === mode)
    if (opponent) {
      this._queue.splice(this._queue.indexOf(opponent), 1)
      const room = await roomManager.create({
        hostId: opponent.playerId,
        hostName: opponent.playerName,
        mode,
        // Use the waiting player's chosen difficulty (they "hosted" the match)
        difficulty: opponent.difficulty || difficulty,
        isPublic: false,
      })
      await roomManager.update(room.id, r => {
        r.players.push({ id: playerId, name: playerName, ready: false, score: 0 })
        r.phase = 'SETUP'
      })
      logger.debug({ roomId: room.id, mode }, 'Quick match paired')
      return { matched: true, roomId: room.id, room: await roomManager.get(room.id) }
    }

    this._queue.push({ playerId, playerName, mode, difficulty, enqueuedAt: Date.now() })
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

  get size() { return this._queue.length }
}

export const quickMatch = new QuickMatchQueue()
