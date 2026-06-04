// Multiplayer handlers for the "match" family of modes (XOX, and later MATH /
// SUDOKU). These reuse the room lifecycle from roomHandlers.js (create / join /
// quick-match / reconnect / disconnect-grace / rematch) and only add the
// game-specific real-time logic. State lives on `room.match` so the GTN/BC
// guess flow (room.round) is left completely untouched.

import { roomManager } from '../game/RoomManager.js'
import { cancelRoomGrace } from './roomHandlers.js'
import { getTimer, clearTimer } from '../game/TurnTimer.js'
import { TicTacToeEngine } from '../game/engines/TicTacToeEngine.js'
import { logger } from '../utils/logger.js'

export const MATCH_MODES = new Set(['XOX', 'MATH', 'SUDOKU'])

export function registerMatchHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id

  // ── Player ready → when both are ready, start the match ───────────────────
  socket.on('match:ready', async ({ roomId } = {}, ack) => {
    try {
      if (typeof roomId !== 'string') return ack?.({ ok: false, error: 'Invalid room' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (!MATCH_MODES.has(room.mode)) return ack?.({ ok: false, error: 'Wrong mode for match' })
      if (!room.players.find(p => p.id === playerId)) {
        return ack?.({ ok: false, error: 'Not a player in this room' })
      }

      socket.join(roomId)
      await roomManager.update(roomId, r => {
        const p = r.players.find(p => p.id === playerId)
        if (p) p.ready = true
      })

      const updated = await roomManager.get(roomId)
      const bothReady = updated.players.length === 2 && updated.players.every(p => p.ready)
      const inLobby = updated.phase === 'SETUP' || updated.phase === 'LOBBY'

      if (bothReady && inLobby) {
        await _startMatch(io, roomId)
      } else {
        io.to(roomId).emit('room:updated', _roomSummary(updated))
      }
      ack?.({ ok: true })
    } catch (err) {
      logger.error({ err }, 'match:ready error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── XOX move ──────────────────────────────────────────────────────────────
  socket.on('xox:move', async ({ roomId, cell } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'XOX' || room.phase !== 'PLAYING') {
        return ack?.({ ok: false, error: 'Match not active' })
      }
      const m = room.match
      if (!m || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
        return ack?.({ ok: false, error: 'Invalid cell' })
      }
      if (m.board[cell] !== null) return ack?.({ ok: false, error: 'Cell occupied' })

      clearTimer(roomId)
      const symbol = m.symbols[playerId]
      let over = false, winnerId = null, draw = false

      await roomManager.update(roomId, r => {
        r.match.board[cell] = symbol
        const w = TicTacToeEngine.winnerOf(r.match.board)
        if (w) {
          over = true; winnerId = playerId; r.match.winnerId = playerId
        } else if (r.match.board.every(c => c !== null)) {
          over = true; draw = true; r.match.draw = true
        } else {
          const opp = r.players.find(p => p.id !== playerId)?.id
          r.match.turnId = opp
        }
      })

      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('xox:update', {
        board:  updated.match.board,
        turnId: updated.match.turnId,
        lastCell: cell,
        by: playerId,
      })
      ack?.({ ok: true })

      if (over) await _endMatch(io, roomId, { winnerId, draw })
      else _startMoveTimer(io, roomId, updated.match.turnId)
    } catch (err) {
      logger.error({ err }, 'xox:move error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Forfeit (explicit "I give up") ────────────────────────────────────────
  socket.on('match:forfeit', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || !MATCH_MODES.has(room.mode)) return ack?.({ ok: false })
      const winnerId = room.players.find(p => p.id !== playerId)?.id || null
      io.to(roomId).emit('match:forfeit', { forfeitPlayerId: playerId, winnerId })
      await _endMatch(io, roomId, { winnerId, draw: false })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })
}

// ── Match start (mode-specific init) ──────────────────────────────────────────
async function _startMatch(io, roomId) {
  const room = await roomManager.get(roomId)
  if (!room) return

  if (room.mode === 'XOX') {
    const [a, b] = room.players
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.match = {
        kind:    'XOX',
        board:   Array(9).fill(null),
        symbols: { [a.id]: 'X', [b.id]: 'O' }, // host is X and moves first
        turnId:  a.id,
        winnerId: null,
        draw:    false,
      }
    })
  }
  // (MATH / SUDOKU init added in their phases.)

  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const s = _findSocket(io, p.id)
    s?.emit('match:start', _matchView(updated, p.id))
  }

  if (updated.mode === 'XOX') _startMoveTimer(io, roomId, updated.match.turnId)
}

// ── Match end ─────────────────────────────────────────────────────────────────
export async function endMatch(io, roomId, { winnerId = null, draw = false } = {}) {
  return _endMatch(io, roomId, { winnerId, draw })
}

async function _endMatch(io, roomId, { winnerId = null, draw = false }) {
  clearTimer(roomId)
  cancelRoomGrace(roomId) // game finished → don't let a late disconnect override it
  await roomManager.update(roomId, r => {
    r.phase = 'GAME_OVER'
    r.winnerId = winnerId
    if (winnerId) {
      const w = r.players.find(p => p.id === winnerId)
      if (w) w.score = (w.score || 0) + 1
    }
  })
  const updated = await roomManager.get(roomId)
  io.to(roomId).emit('match:over', {
    winnerId,
    draw,
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })
}

// ── Per-turn timer (anti-stall) ────────────────────────────────────────────────
function _startMoveTimer(io, roomId, currentTurnId) {
  const timer = getTimer(roomId, async (rid) => {
    const room = await roomManager.get(rid)
    if (!room || room.phase !== 'PLAYING') return
    // The stalling player loses their turn → opponent wins.
    const winnerId = room.players.find(p => p.id !== currentTurnId)?.id || null
    io.to(rid).emit('match:timeout', { playerId: currentTurnId })
    await _endMatch(io, rid, { winnerId, draw: false })
  })
  timer.start()
  io.to(roomId).emit('match:turn', { turnId: currentTurnId, timerMs: 30_000 })
}

// ── Views (no hidden info for XOX, so a single broadcast view is fine) ─────────
function _matchView(room, viewerId) {
  return {
    room:  _roomSummary(room),
    match: _publicMatch(room.match),
    you:   viewerId,
  }
}

function _publicMatch(match) {
  if (!match) return null
  if (match.kind === 'XOX') {
    return {
      kind: 'XOX',
      board: match.board,
      symbols: match.symbols,
      turnId: match.turnId,
      winnerId: match.winnerId,
      draw: match.draw,
    }
  }
  return match
}

function _roomSummary(room) {
  return {
    id: room.id, code: room.code, mode: room.mode, difficulty: room.difficulty,
    phase: room.phase,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, score: p.score })),
    hostId: room.hostId,
    spectatorCount: room.spectators?.length || 0,
  }
}

function _findSocket(io, targetPlayerId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.handshake.auth?.playerId === targetPlayerId) return s
  }
  return null
}

// Exposed so roomHandlers' reconnect can rebuild the public match view.
export function publicMatchFor(room) {
  return _publicMatch(room?.match)
}
