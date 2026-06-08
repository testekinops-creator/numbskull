import { roomManager } from '../game/RoomManager.js'
import { quickMatch } from '../game/QuickMatch.js'
import { clearTimer } from '../game/TurnTimer.js'
import { publicMatchFor, onPartyPlayerLeft } from './matchHandlers.js'
import { logger } from '../utils/logger.js'

export function registerRoomHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id
  const playerName = auth.playerName || 'Anonymous'

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('room:create', async ({ mode = 'GTN', difficulty = 'medium', isPublic = true, maxPlayers = 2 } = {}, ack) => {
    try {
      const room = await roomManager.create({ hostId: playerId, hostName: playerName, mode, difficulty, isPublic, maxPlayers })
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
      if (typeof code !== 'string' || !code.trim()) {
        return ack?.({ ok: false, error: 'Enter a room code' })
      }
      const room = await roomManager.getByCode(code.trim())
      if (!room) return ack?.({ ok: false, error: 'Room not found' })

      // Validate AND mutate under the room lock so two simultaneous joins can't
      // both pass the capacity check and overfill the room (was a 3-player race).
      let joinError = null
      await roomManager.update(room.id, r => {
        const cap = r.maxPlayers || 2
        if (r.players.find(p => p.id === playerId)) return   // idempotent re-join
        if (r.players.length >= cap) { joinError = 'Room is full'; return }
        if (r.phase !== 'LOBBY')   { joinError = 'Game already in progress'; return }
        r.players.push({ id: playerId, name: playerName, ready: false, score: 0 })
        // 1v1 rooms auto-advance to SETUP at 2; party rooms (cap>2) wait for the
        // host to press Start.
        if (cap === 2 && r.players.length === 2) r.phase = 'SETUP'
      })
      if (joinError) return ack?.({ ok: false, error: joinError })

      socket.join(room.id)
      const updated = await roomManager.get(room.id)
      io.to(room.id).emit('room:updated', sanitize(updated, playerId))
      ack?.({ ok: true, room: sanitize(updated, playerId) })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Quick match ───────────────────────────────────────────────────────────
  socket.on('room:quickmatch', async ({ mode = 'GTN', difficulty = 'medium' } = {}, ack) => {
    try {
      // Remove stale (disconnected) entries before pairing.
      quickMatch.prune(pid => !!_findSocket(io, pid))
      // Account-stable key: a registered user can't self-match across two devices.
      const accountKey = socket.handshake.auth?.userId || playerId
      const result = await quickMatch.enqueue(playerId, playerName, mode, difficulty, accountKey)
      if (result.matched) {
        const room = result.room

        // Join Player B (the one who triggered the match)
        socket.join(room.id)
        _clearQuickmatchTimeout(playerId)

        // Find Player A (the one who was waiting in queue) and join them too
        const hostId = room.hostId
        if (hostId && hostId !== playerId) {
          _clearQuickmatchTimeout(hostId)     // they're matched → cancel their timeout
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
        // Waiting in queue → arm a timeout so nobody searches forever.
        _armQuickmatchTimeout(io, socket, playerId)
        ack?.({ ok: true, matched: false, waiting: true })
      }
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Cancel quick match ────────────────────────────────────────────────────
  socket.on('room:quickmatch_cancel', (_, ack) => {
    quickMatch.dequeue(playerId)
    _clearQuickmatchTimeout(playerId)
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
      // New game modes (XOX/MATH/SUDOKU) rebuild from room.match; null for GTN/BC
      match:    publicMatchFor(room),
    }
    // SPIN carries per-viewer private state: this player's own wrong letters and
    // the remaining round-countdown (server-relative → both clients stay synced).
    if (snapshot.match?.kind === 'SPIN') {
      snapshot.match.myWrongLetters = room.match?.wrongGuesses?.[playerId] || []
      snapshot.match.countdownMs = room.match?.nextRoundAt ? Math.max(0, room.match.nextRoundAt - Date.now()) : 0
      snapshot.match.turnCountdownMs = room.match?.turnEndsAt ? Math.max(0, room.match.turnEndsAt - Date.now()) : 0
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
    _clearQuickmatchTimeout(playerId)
  })
}

// ── Quick-match queue timeout (no opponent found → stop searching) ───────────
const quickmatchTimers = new Map()  // playerId -> timeout
const QUICKMATCH_TIMEOUT_MS = Number(process.env.QUICKMATCH_TIMEOUT_MS) || 60_000

function _armQuickmatchTimeout(io, socket, playerId) {
  _clearQuickmatchTimeout(playerId)
  const t = setTimeout(() => {
    quickmatchTimers.delete(playerId)
    quickMatch.dequeue(playerId)
    socket.emit('room:quickmatch_timeout')
  }, QUICKMATCH_TIMEOUT_MS)
  quickmatchTimers.set(playerId, t)
}

function _clearQuickmatchTimeout(playerId) {
  const t = quickmatchTimers.get(playerId)
  if (t) { clearTimeout(t); quickmatchTimers.delete(playerId) }
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
    // Party rooms (>2): drop just this player and keep the room going.
    if ((room.maxPlayers || 2) > 2) return _removeFromParty(io, roomId, playerId, leaver.name || playerName, 'disconnected')
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
  // Party rooms (>2): remove just this player and keep the room going.
  if ((room.maxPlayers || 2) > 2) return _removeFromParty(io, roomId, playerId, leaver?.name || playerName, reason)
  await _closeRoomNotifying(io, room, roomId, leaver?.name || playerName, reason)
}

// Remove one player from a party room and keep the rest playing (close only when
// empty; end the match if it drops below 2 mid-game).
async function _removeFromParty(io, roomId, leaverId, leaverName, reason) {
  await roomManager.update(roomId, r => {
    r.players = r.players.filter(p => p.id !== leaverId)
    if (r.hostId === leaverId && r.players[0]) r.hostId = r.players[0].id
  })
  const room = await roomManager.get(roomId)
  if (!room) return
  if (room.players.length === 0) {
    clearTimer(roomId); cancelRoomGrace(roomId)
    await roomManager.delete(roomId)
    io.to(roomId).emit('room:closed', { roomId })
    return
  }
  io.to(roomId).emit('room:player_left', { playerId: leaverId, leaverName, reason })
  io.to(roomId).emit('room:updated', sanitize(room, null))
  await onPartyPlayerLeft(io, roomId, leaverId)
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
    maxPlayers: room.maxPlayers || 2,
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
