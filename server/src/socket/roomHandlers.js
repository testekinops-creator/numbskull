import { roomManager } from '../game/RoomManager.js'
import { quickMatch } from '../game/QuickMatch.js'
import { clearTimer } from '../game/TurnTimer.js'
import { publicMatchFor, onPartyPlayerLeft } from './matchHandlers.js'
import { makeBot } from '../game/rmcsBot.js'
import { logger } from '../utils/logger.js'

export function registerRoomHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id
  const playerName = auth.playerName || 'Anonymous'
  const playerAvatar = auth.avatar || null   // chosen emoji-avatar id (else client falls back to a playerId-seeded one)

  // ── Keep-alive heartbeat ───────────────────────────────────────────────────
  // Rooms are evicted after ROOM_TTL_MS of no update. Most games refresh that via
  // their move/turn handlers, but turn-less or slow games (e.g. SOS, which now has
  // no turn timer) can sit idle while players are still present — so the room
  // would expire and bounce everyone to the lobby. A periodic touch from a
  // connected member keeps it alive; abandoned rooms (no client) still expire.
  socket.on('room:heartbeat', async ({ roomId } = {}) => {
    try {
      if (!roomId) return
      const room = await roomManager.get(roomId)
      if (!room || !room.players.some(p => p.id === playerId)) return
      await roomManager.update(roomId, () => {})   // no-op fn → just bumps updatedAt + TTL
    } catch { /* best-effort keep-alive */ }
  })

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on('room:create', async ({ mode = 'GTN', difficulty = 'medium', isPublic = true, maxPlayers = 2 } = {}, ack) => {
    try {
      // Raja Mantri Chor Sipahi is exactly-4 by rule — ignore whatever the client sent.
      if (mode === 'RMCS') maxPlayers = 4
      const room = await roomManager.create({ hostId: playerId, hostName: playerName, hostAvatar: playerAvatar, mode, difficulty, isPublic, maxPlayers })
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
        r.players.push({ id: playerId, name: playerName, avatar: playerAvatar, ready: false, score: 0 })
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

  // ── Fill a seat with a bot (RMCS only — so 1–3 friends can still play) ──────
  socket.on('room:add_bot', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.mode !== 'RMCS') return ack?.({ ok: false, error: 'Bots are only for Raja Mantri' })
      if (room.hostId !== playerId) return ack?.({ ok: false, error: 'Only the host can add bots' })
      if (room.phase !== 'LOBBY' && room.phase !== 'SETUP') return ack?.({ ok: false, error: 'Game already started' })

      let added = false
      await roomManager.update(roomId, r => {
        if (r.players.length >= (r.maxPlayers || 4)) return
        r.players.push(makeBot(r.players.map(p => p.name)))
        added = true
      })
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('room:updated', sanitize(updated, null))
      ack?.({ ok: added, error: added ? null : 'Table is already full' })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  socket.on('room:remove_bot', async ({ roomId, botId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.hostId !== playerId) return ack?.({ ok: false, error: 'Only the host can remove bots' })
      if (room.phase !== 'LOBBY' && room.phase !== 'SETUP') return ack?.({ ok: false, error: 'Game already started' })

      await roomManager.update(roomId, r => {
        // Remove the named bot, else the most recently added one.
        let idx = botId ? r.players.findIndex(p => p.isBot && p.id === botId) : -1
        if (idx < 0) for (let i = r.players.length - 1; i >= 0; i--) if (r.players[i].isBot) { idx = i; break }
        if (idx >= 0) r.players.splice(idx, 1)
      })
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('room:updated', sanitize(updated, null))
      ack?.({ ok: true })
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
      const result = await quickMatch.enqueue(playerId, playerName, mode, difficulty, accountKey, playerAvatar)
      if (result.matched) {
        const room = result.room

        // Join the triggering player (this socket).
        socket.join(room.id)
        _clearQuickmatchTimeout(playerId)

        // Everyone else in the match was waiting in the queue — join their sockets
        // and tell them they've been matched. `memberIds` covers group modes
        // (Raja Mantri = 4); for 1v1 it's just the host who was waiting.
        const others = (result.memberIds || [room.hostId]).filter(id => id && id !== playerId)
        for (const id of others) {
          _clearQuickmatchTimeout(id)
          const s = _findSocket(io, id)
          if (s) {
            s.join(room.id)
            s.emit('room:quickmatch_found', sanitize(room, id))
          }
        }

        // Broadcast updated room to everyone now in the room.
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
    // `gone: true` = the room is genuinely over (so the client should leave). A
    // missing `gone` (e.g. a timeout) means "try again", not "go home".
    if (!room) return ack?.({ ok: false, gone: true, error: 'Room expired' })
    const inRoom = room.players.find(p => p.id === playerId)
    if (!inRoom) return ack?.({ ok: false, gone: true, error: 'Not a player in this room' })
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
    // RMCS: re-deliver the reconnecting player's own (still-secret) role.
    if (snapshot.match?.kind === 'RMCS') {
      snapshot.match.myRole = room.match?.roles?.[playerId] || null
    }
    // Tell the reconnecting player who's actually live right now: if an opponent
    // is mid-grace (locked / dropped) the client must show the "waiting…" state
    // instead of a normal-looking board, and knows exactly when the room closes.
    if (snapshot.room?.players) {
      snapshot.room.players = snapshot.room.players.map(p => ({
        ...p,
        connected: p.id === playerId || _playerHasLiveSocket(io, p.id, roomId),
      }))
      const goneOpp = snapshot.room.players.find(p => p.id !== playerId && !p.connected)
      if (goneOpp && room.phase !== 'GAME_OVER') {
        const dl = disconnectDeadlines.get(`${goneOpp.id}:${roomId}`)
        snapshot.opponentDisconnected = true
        snapshot.roomClosesInMs = dl ? Math.max(0, dl - Date.now()) : DISCONNECT_GRACE_MS
      }
    }
    ack?.({ ok: true, room: snapshot.room, snapshot })
  })

  // Use 'disconnecting' — socket.rooms is still populated here
  socket.on('disconnecting', () => {
    for (const r of socket.rooms) {
      if (r === socket.id) continue
      // If the SAME player already reconnected on another socket (rapid phone
      // lock/unlock), this is just the stale socket dying — ignore it so we don't
      // flash a false "opponent dropped" or schedule a needless close.
      if (_playerHasLiveSocket(io, playerId, r, socket.id)) continue
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

// ── Disconnect grace timers (survive page refresh / phone lock) ──────────────
// Mobile users routinely lock the screen mid-game, which drops the socket. We
// keep their seat for a grace window and restore full state when they return.
// 60s by default (tunable) — long enough to survive a lock/unlock.
const disconnectTimers = new Map()    // `${playerId}:${roomId}` -> timeout
const disconnectDeadlines = new Map() // `${playerId}:${roomId}` -> ms timestamp the room closes
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 60_000

// Is this player currently connected to the room on SOME live socket? After a
// reconnect they hold a NEW socket id while the old (frozen) one may still be
// lingering — so an optional excludeId lets the old socket ignore itself.
function _playerHasLiveSocket(io, playerId, roomId, excludeId = null) {
  for (const [, s] of io.sockets.sockets) {
    if (s.id === excludeId) continue
    if (s.handshake.auth?.playerId === playerId && s.rooms.has(roomId)) return true
  }
  return false
}

function _scheduleDisconnectClose(io, playerId, playerName, roomId) {
  const key = `${playerId}:${roomId}`
  if (disconnectTimers.has(key)) clearTimeout(disconnectTimers.get(key))
  disconnectDeadlines.set(key, Date.now() + DISCONNECT_GRACE_MS)
  const t = setTimeout(async () => {
    disconnectTimers.delete(key)
    disconnectDeadlines.delete(key)
    const room = await roomManager.get(roomId)
    if (!room) return
    // G3: game already finished → don't override the result with "opponent left"
    if (room.phase === 'GAME_OVER') return
    const leaver = room.players.find(p => p.id === playerId)
    if (!leaver) return  // already removed
    // Ghost-socket guard: if they reconnected on a new socket, don't evict them.
    if (_playerHasLiveSocket(io, playerId, roomId)) return
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
  disconnectDeadlines.delete(key)
}

// Cancel ALL grace timers for a room (used when a round ends or room closes)
export function cancelRoomGrace(roomId) {
  for (const key of [...disconnectTimers.keys()]) {
    if (key.endsWith(`:${roomId}`)) {
      clearTimeout(disconnectTimers.get(key))
      disconnectTimers.delete(key)
    }
  }
  for (const key of [...disconnectDeadlines.keys()]) {
    if (key.endsWith(`:${roomId}`)) disconnectDeadlines.delete(key)
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
    // Host must be a human — never hand the room to a seat-filler bot.
    if (r.hostId === leaverId) {
      const human = r.players.find(p => !p.isBot)
      r.hostId = human ? human.id : (r.players[0]?.id || r.hostId)
    }
  })
  const room = await roomManager.get(roomId)
  if (!room) return
  // Close once no humans remain (an all-bot room is pointless).
  if (room.players.filter(p => !p.isBot).length === 0) {
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
      avatar: p.avatar ?? null,
      ready: p.ready,
      score: p.score,
      isBot: !!p.isBot,
      isYou: p.id === viewerId,
    })),
    spectatorCount: room.spectators.length,
    round: room.round ? sanitizeRound(room.round, viewerId) : null,
    hostId: room.hostId,
    createdAt: room.createdAt,   // lets the lobby show a truthful "waiting for…" clock
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
