import { v4 as uuidv4 } from 'uuid'

const replays = new Map()
const featured = []
const MAX_FEATURED = 20

export const ReplayTheater = {
  saveReplay({ playerId, playerName, mode, guesses, won, timeMs, optimalMoves }) {
    const id = uuidv4()
    const replay = { id, playerId, playerName, mode, guesses, won, timeMs, optimalMoves, createdAt: Date.now(), views: 0 }
    replays.set(id, replay)
    if (won && this._isHighlight(replay)) this._feature(replay)
    return id
  },

  getReplay(id) { return replays.get(id) || null },

  watchReplay(id) {
    const r = replays.get(id)
    if (r) r.views++
    return r || null
  },

  getFeatured(limit = 10) {
    return featured
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(r => this._summary(r))
  },

  getPlayerReplays(playerId, limit = 20) {
    return [...replays.values()]
      .filter(r => r.playerId === playerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(r => this._summary(r))
  },

  _isHighlight(replay) {
    if (replay.mode === 'GTN' && replay.optimalMoves && replay.guesses.length <= replay.optimalMoves) return true
    if (replay.mode === 'BC' && replay.guesses.length <= 4) return true
    if (replay.timeMs && replay.timeMs < 8000) return true
    return false
  },

  _feature(replay) {
    if (!featured.find(r => r.id === replay.id)) {
      featured.unshift(replay)
      if (featured.length > MAX_FEATURED) featured.pop()
    }
  },

  _summary(r) {
    return { id: r.id, playerName: r.playerName, mode: r.mode, guessCount: r.guesses.length, won: r.won, timeMs: r.timeMs, optimalMoves: r.optimalMoves, views: r.views, createdAt: r.createdAt }
  },
}
