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
import { SocialService } from '../services/SocialService.js'
import { AuthService } from '../services/AuthService.js'

const socketPlayerMap = new Map()

// userId → number of live sockets. Drives presence: a user is "online" while this
// is ≥1. Counting (not a boolean) debounces multi-tab / quick-reconnect churn — we
// only fan out friend:online on 0→1 and friend:offline on 1→0.
const onlineCounts = new Map()

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

// Emit an event to every live socket belonging to a DB userId (a user may have
// several tabs / devices). No-op if the user has no userId or isn't connected.
export function emitToUser(userId, event, payload) {
  if (!_io || !userId) return false
  let delivered = false
  for (const [, s] of _io.sockets.sockets) {
    if (s.handshake.auth?.userId === userId) { s.emit(event, payload); delivered = true }
  }
  return delivered
}

// Is this registered user currently connected (≥1 live socket)?
export function isUserOnline(userId) {
  if (!userId) return false
  return (onlineCounts.get(userId) || 0) > 0
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

  // ── Handshake auth ──────────────────────────────────────────────────────────
  // The account identity (userId) MUST come from a verified access token — never
  // trust a client-supplied userId (a client could put any victim's id there and
  // receive their private events / record results to their account). Guests have
  // no token → userId stays null. An invalid/expired token is downgraded to guest
  // rather than hard-rejected, so a stale token never bricks the connection.
  io.use((socket, next) => {
    const auth = socket.handshake.auth || {}
    let verifiedUserId = null
    if (auth.token) {
      try { verifiedUserId = AuthService.verifyAccess(auth.token)?.sub || null } catch { verifiedUserId = null }
    }
    auth.userId = verifiedUserId            // overwrite whatever the client claimed
    socket.handshake.auth = auth
    next()
  })

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Client connected')

    const { playerId, playerName, userId } = socket.handshake.auth

    if (playerId) {
      const prev = socketPlayerMap.get(playerId)
      if (prev && prev !== socket.id) {
        const prevSocket = io.sockets.sockets.get(prev)
        prevSocket?.emit('error:duplicate_tab')
        prevSocket?.disconnect(true)
      }
      socketPlayerMap.set(playerId, socket.id)
    }

    // ── Presence: tell this registered user's friends they're online ──────────
    // Only on the first socket (0→1) so extra tabs / reconnects don't re-toast.
    // Guests (no userId) are never tracked. Wrapped so a presence hiccup can't
    // break the connection lifecycle.
    if (userId) {
      const next = (onlineCounts.get(userId) || 0) + 1
      onlineCounts.set(userId, next)
      if (next === 1) {
        try {
          for (const friendId of SocialService.getFriendIds(userId)) {
            emitToUser(friendId, 'friend:online', { userId, name: playerName })
          }
        } catch (e) { logger.warn({ err: e.message }, 'presence online fan-out failed') }
      }
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
      // Presence: last socket gone (1→0) ⇒ tell friends they went offline.
      if (userId) {
        const next = (onlineCounts.get(userId) || 1) - 1
        if (next <= 0) {
          onlineCounts.delete(userId)
          try {
            for (const friendId of SocialService.getFriendIds(userId)) {
              emitToUser(friendId, 'friend:offline', { userId })
            }
          } catch (e) { logger.warn({ err: e.message }, 'presence offline fan-out failed') }
        } else {
          onlineCounts.set(userId, next)
        }
      }
      logger.debug({ socketId: socket.id, reason }, 'Client disconnected')
    })
  })

  return io
}
