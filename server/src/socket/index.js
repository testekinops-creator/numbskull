import { Server } from 'socket.io'
import { logger } from '../utils/logger.js'
import { registerRoomHandlers } from './roomHandlers.js'
import { registerGameHandlers } from './gameHandlers.js'
import { socketRateLimit } from '../middleware/socketRateLimit.js'

const socketPlayerMap = new Map()

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
  })

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

    socket.on('disconnect', (reason) => {
      if (playerId && socketPlayerMap.get(playerId) === socket.id) {
        socketPlayerMap.delete(playerId)
      }
      logger.debug({ socketId: socket.id, reason }, 'Client disconnected')
    })
  })

  return io
}
