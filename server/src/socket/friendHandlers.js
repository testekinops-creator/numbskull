// In-room friend requests. Both players must be signed-in (the handshake
// carries the DB userId for registered users; guests have userId = null).
// Relayed over the socket and persisted via SocialService.
import { roomManager } from '../game/RoomManager.js'
import { SocialService } from '../services/SocialService.js'
import { logger } from '../utils/logger.js'

function _findSocket(io, targetPlayerId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.handshake.auth?.playerId === targetPlayerId) return s
  }
  return null
}

export function registerFriendHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId   = auth.playerId || socket.id
  const userId     = auth.userId || null
  const playerName = auth.playerName || 'Player'

  socket.on('friend:request', async ({ roomId } = {}, ack) => {
    try {
      if (!userId) return ack?.({ ok: false, error: 'Sign in to add friends' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      const opp = room.players.find(p => p.id !== playerId)
      if (!opp) return ack?.({ ok: false, error: 'No opponent yet' })

      const oppSocket = _findSocket(io, opp.id)
      const oppUserId = oppSocket?.handshake.auth?.userId
      if (!oppUserId) return ack?.({ ok: false, error: `${opp.name} is playing as a guest` })

      SocialService.sendFriendRequest(userId, oppUserId)
      oppSocket.emit('friend:incoming', { fromName: playerName, fromPlayerId: playerId })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // Report whether the two players in the room are already friends, so the
  // client can hide the add-friend button on join (past-session friendship).
  socket.on('friend:status', async ({ roomId } = {}, ack) => {
    try {
      if (!userId) return ack?.({ status: 'idle' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ status: 'idle' })
      const opp = room.players.find(p => p.id !== playerId)
      if (!opp) return ack?.({ status: 'idle' })
      const oppSocket = _findSocket(io, opp.id)
      const oppUserId = oppSocket?.handshake.auth?.userId
      if (!oppUserId) return ack?.({ status: 'idle' })
      ack?.({ status: SocialService.areFriends(userId, oppUserId) ? 'friends' : 'idle' })
    } catch {
      ack?.({ status: 'idle' })
    }
  })

  socket.on('friend:accept', async ({ roomId } = {}, ack) => {
    try {
      if (!userId) return ack?.({ ok: false, error: 'Sign in to add friends' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      const opp = room.players.find(p => p.id !== playerId)
      const oppSocket = opp ? _findSocket(io, opp.id) : null
      const oppUserId = oppSocket?.handshake.auth?.userId
      if (!oppUserId) return ack?.({ ok: false, error: 'Opponent left' })

      SocialService.acceptFriendRequest(userId, oppUserId)  // (toId = me, fromId = opp)
      socket.emit('friend:accepted', { name: opp.name })
      oppSocket.emit('friend:accepted', { name: playerName })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })
}
