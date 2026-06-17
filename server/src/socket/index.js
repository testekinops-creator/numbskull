import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { logger } from '../utils/logger.js'
import { redisEnabled, getRedisPubSub } from '../config/redis.js'
import { registerRoomHandlers } from './roomHandlers.js'
import { registerGameHandlers } from './gameHandlers.js'
import { registerMatchHandlers } from './matchHandlers.js'
import { registerChatHandlers } from './chatHandlers.js'
import { registerCallHandlers } from './callHandlers.js'
import { registerFriendHandlers } from './friendHandlers.js'
import { socketRateLimit } from '../middleware/socketRateLimit.js'
import { roomManager } from '../game/RoomManager.js'

const socketPlayerMap = new Map()

// Live io instance, exposed so REST routes (e.g. friends) can answer "which room
// is this user currently in?" without maintaining a separate presence map.
let _io = null

// The room a given DB userId is actively a PLAYER in (not merely spectating),
// or null. Respects the user's "let friends watch me" preference (handshake auth
// `allowWatch`, default true). Used to show a Watch button next to live friends.
export function getWatchableRoomForUser(userId) {
  if (!_io || !userId) return null
  for (const [, s] of _io.sockets.sockets) {
    if (s.handshake.auth?.userId !== userId) continue
    if (s.handshake.auth?.allowWatch === false) return null   // opted out of being watched
    for (const r of s.rooms) {
      if (r === s.id) continue
      if (r === s.data?.spectatingRoom) continue              // their own watching, not a game
      const room = roomManager.peek(r)
      return room && room.phase === 'PLAYING' ? r : null      // only while a match is live
    }
    return null
  }
  return null
}

export function setupSocket(httpServer) {
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} not allowed`))
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Detect a silently-dropped client (phone lock, network loss) faster than the
    // ~45s default so the reconnect grace + room cleanup start promptly: a missed
    // heartbeat is now noticed in ~pingInterval+pingTimeout = 30s, not 45s.
    pingInterval: 20_000,
    pingTimeout: 10_000,
  })
  _io = io

  // Multi-instance event fan-out (only when REDIS_URL is configured)
  if (redisEnabled) {
    try {
      const { pub, sub } = getRedisPubSub()
      io.adapter(createAdapter(pub, sub))
      logger.info('Socket.IO Redis adapter enabled')
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to enable Redis adapter — continuing single-instance')
    }
  }

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Client connected')

    const { playerId, playerName } = socket.handshake.auth

    if (playerId) {
      const prev = socketPlayerMap.get(playerId)
      if (prev && prev !== socket.id) {
        const prevSocket = io.sockets.sockets.get(prev)
        prevSocket?.emit('error:duplicate_tab')
        prevSocket?.disconnect(true)
      }
      socketPlayerMap.set(playerId, socket.id)
    }

    socket.use(([event, ...args], next) => socketRateLimit(socket, event, next))

    registerRoomHandlers(io, socket)
    registerGameHandlers(io, socket)
    registerMatchHandlers(io, socket)
    registerChatHandlers(io, socket)
    registerCallHandlers(io, socket)
    registerFriendHandlers(io, socket)

    socket.on('disconnect', (reason) => {
      if (playerId && socketPlayerMap.get(playerId) === socket.id) {
        socketPlayerMap.delete(playerId)
      }
      logger.debug({ socketId: socket.id, reason }, 'Client disconnected')
    })
  })

  return io
}
