import { roomManager } from '../game/RoomManager.js'
import { quickMatch } from '../game/QuickMatch.js'
import { clearTimer } from '../game/TurnTimer.js'
import { logger } from '../utils/logger.js'

export function registerRoomHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id
  const playerName = auth.playerName || 'Anonymous'

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('room:create', async ({ mode = 'GTN', difficulty = 'medium', isPublic = true } = {}, ack) => {
    try {
      const room = await roomManager.create({ hostId: playerId, hostName: playerName, mode, difficulty, isPublic })
      socket.join(room.id)
      ack?.({ ok: true, room: sanitize(room, playerId) })
      logger.debug({ roomId: room.id }, 'Room created via socket')
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Join by code ──────────────────────────────────────────────────────────
  socket.on('room:join', async ({ code } = {}, ack) => {
    try {
      const room = await roomManager.getByCode(code)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.players.length >= 2 && !room.players.find(p => p.id === playerId)) {
        return ack?.({ ok: false, error: 'Room is full' })
      }
      if (room.phase !== 'LOBBY' && !room.players.find(p => p.id === playerId)) {
        return ack?.({ ok: false, error: 'Game already in progress' })
      }

      const alreadyIn = room.players.find(p => p.id === playerId)
      if (!alreadyIn) {
        await roomManager.update(room.id, r => {
          r.players.push({ id: playerId, name: playerName, ready: false, score: 0 })
          if (r.players.length === 2) r.phase = 'SETUP'
        })
      }

      socket.join(room.id)
      const updated = await roomManager.get(room.id)
      io.to(room.id).emit('room:updated', sanitize(updated, playerId))
      ack?.({ ok: true, room: sanitize(updated, playerId) })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Quick match ───────────────────────────────────────────────────────────
  socket.on('room:quickmatch', async ({ mode = 'GTN' } = {}, ack) => {
    try {
      const result = await quickMatch.enqueue(playerId, playerName, mode)
      if (result.matched) {
        const room = result.room

        // Join Player B (the one who triggered the match)
        socket.join(room.id)

        // Find Player A (the one who was waiting in queue) and join them too
        const hostId = room.hostId
        if (hostId && hostId !== playerId) {
          const hostSocket = _findSocket(io, hostId)
          if (hostSocket) {
            hostSocket.join(room.id)
            // Tell Player A they've been matched — includes their sanitized room view
            hostSocket.emit('room:quickmatch_found', sanitize(room, hostId))
          }
        }

        // Broadcast updated room to everyone now in the room (both players)
        io.to(room.id).emit('room:updated', sanitize(room, null))
        ack?.({ ok: true, matched: true, room: sanitize(room, playerId) })
      } else {
        ack?.({ ok: true, matched: false })
      }
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Cancel quick match ────────────────────────────────────────────────────
  socket.on('room:quickmatch_cancel', (_, ack) => {
    quickMatch.dequeue(playerId)
    ack?.({ ok: true })
  })

  // ── Spectate ──────────────────────────────────────────────────────────────
  socket.on('room:spectate', async ({ roomId } = {}, ack) => {
    const room = await roomManager.get(roomId)
    if (!room) return ack?.({ ok: false, error: 'Room not found' })
    if (!room.spectators.includes(playerId)) {
      await roomManager.update(roomId, r => r.spectators.push(playerId))
    }
    socket.join(roomId)
    const updated = await roomManager.get(roomId)
    ack?.({ ok: true, room: sanitize(updated, playerId) })
  })

  // ── Leave room ────────────────────────────────────────────────────────────
  socket.on('room:leave', async ({ roomId } = {}, ack) => {
    await _handleLeave(io, socket, playerId, playerName, roomId, 'left')
    ack?.({ ok: true })
  })

  // ── List public rooms ─────────────────────────────────────────────────────
  socket.on('room:list', (_, ack) => {
    const rooms = roomManager.listPublic().map(r => sanitize(r, playerId))
    ack?.({ ok: true, rooms })
  })

  // ── Reconnect ─────────────────────────────────────────────────────────────
  socket.on('room:reconnect', async ({ roomId } = {}, ack) => {
    // Cancel any pending disconnect-close grace timer for this player
    _cancelDisconnectClose(playerId, roomId)

    const room = await roomManager.get(roomId)
    if (!room) return ack?.({ ok: false, error: 'Room expired' })
    const inRoom = room.players.find(p => p.id === playerId)
    if (!inRoom) return ack?.({ ok: false, error: 'Not a player in this room' })
    socket.join(roomId)
    io.to(roomId).emit('player:reconnected', { playerId, playerName })

    // Full state snapshot so the client can rebuild after a refresh / network drop
    const round = room.round || {}
    const snapshot = {
      room:     sanitize(room, playerId),
      phase:    room.phase,
      guesses:  (round.guesses || []).map(g => ({
        guesser: g.playerId,
        guess:   g.guess,
        result:  g.result,
      })),
      turnId:   round.turnId || null,
      mySecret: round.secrets?.[playerId] || null,
      winnerId: room.winnerId || null,
    }
    ack?.({ ok: true, room: snapshot.room, snapshot })
  })

  // Use 'disconnecting' — socket.rooms is still populated here
  socket.on('disconnecting', () => {
    for (const r of socket.rooms) {
      if (r === socket.id) continue
      // G4: tell the opponent this player dropped (they may come back during grace)
      socket.to(r).emit('player:disconnected', { playerId, playerName })
      _scheduleDisconnectClose(io, playerId, playerName, r)
    }
  })

  socket.on('disconnect', () => {
    quickMatch.dequeue(playerId)
  })
}

// ── Disconnect grace timers (survive page refresh) ───────────────────────────
const disconnectTimers = new Map()  // `${playerId}:${roomId}` -> timeout
const DISCONNECT_GRACE_MS = 10_000

function _scheduleDisconnectClose(io, playerId, playerName, roomId) {
  const key = `${playerId}:${roomId}`
  if (disconnectTimers.has(key)) clearTimeout(disconnectTimers.get(key))
  const t = setTimeout(async () => {
    disconnectTimers.delete(key)
    const room = await roomManager.get(roomId)
    if (!room) return
    // G3: game already finished → don't override the result with "opponent left"
    if (room.phase === 'GAME_OVER') return
    const leaver = room.players.find(p => p.id === playerId)
    if (!leaver) return  // already removed
    await _closeRoomNotifying(io, room, roomId, leaver.name || playerName, 'disconnected')
  }, DISCONNECT_GRACE_MS)
  disconnectTimers.set(key, t)
}

function _cancelDisconnectClose(playerId, roomId) {
  const key = `${playerId}:${roomId}`
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key))
    disconnectTimers.delete(key)
  }
}

// Cancel ALL grace timers for a room (used when a round ends or room closes)
export function cancelRoomGrace(roomId) {
  for (const key of [...disconnectTimers.keys()]) {
    if (key.endsWith(`:${roomId}`)) {
      clearTimeout(disconnectTimers.get(key))
      disconnectTimers.delete(key)
    }
  }
}

// Explicit leave (Leave / Home button)
async function _handleLeave(io, socket, playerId, playerName, roomId, reason = 'left') {
  _cancelDisconnectClose(playerId, roomId)
  const room = await roomManager.get(roomId)
  if (!room) return
  const leaver = room.players.find(p => p.id === playerId)
  socket.leave?.(roomId)
  await _closeRoomNotifying(io, room, roomId, leaver?.name || playerName, reason)
}

// Notify any remaining player, then close the room for everyone
async function _closeRoomNotifying(io, room, roomId, leaverName, reason) {
  clearTimer(roomId)
  cancelRoomGrace(roomId)
  const stillExists = await roomManager.get(roomId)
  if (!stillExists) return  // already closed

  // If another real player is still here, tell them their opponent left
  const hasOpponent = room.players && room.players.length > 1
  if (hasOpponent) {
    io.to(roomId).emit('game:opponent_left', { leaverName, reason })
  }
  await roomManager.delete(roomId)
  io.to(roomId).emit('room:closed', { roomId })
}

function _findSocket(io, targetPlayerId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.handshake.auth?.playerId === targetPlayerId) return s
  }
  return null
}

function sanitize(room, viewerId) {
  if (!room) return null
  return {
    id: room.id,
    code: room.code,
    mode: room.mode,
    difficulty: room.difficulty,
    isPublic: room.isPublic,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      score: p.score,
      isYou: p.id === viewerId,
    })),
    spectatorCount: room.spectators.length,
    round: room.round ? sanitizeRound(room.round, viewerId) : null,
    hostId: room.hostId,
  }
}

function sanitizeRound(round, viewerId) {
  return {
    number:    round.number,
    phase:     round.phase,
    turnId:    round.turnId,
    guesses:   round.guesses || [],
    opponentGuessCount: round.opponentGuessCount || 0,
    mySecret:  round.secrets?.[viewerId] != null ? '••••' : null,
    secretSet: round.secrets && Object.keys(round.secrets).length === 2,
    timerStart: round.timerStart || null,
  }
}
