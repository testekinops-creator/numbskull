import { createServer } from 'http'
import app from './app.js'
import { setupSocket } from './socket/index.js'
import { logger } from './utils/logger.js'
import { SocialService } from './services/SocialService.js'

const PORT = process.env.PORT || 4000

// Crash guard: a stray rejection/throw in an async callback (e.g. a per-turn
// timer, or a DB write when the serverless Postgres scaled to zero and killed
// the connection — Neon "57P01 terminating connection due to administrator
// command") must NOT take down the whole process — that would disconnect every
// player in every room at once. Log it and keep serving.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection (kept process alive)')
})

// Once the server is actually listening, a runtime uncaughtException is kept
// alive for the same reason (one stray error shouldn't drop every live game).
// BEFORE we're listening, a fatal boot error (e.g. EADDRINUSE) should still exit
// rather than leave a zombie that isn't serving.
let serverReady = false
process.on('uncaughtException', (err) => {
  logger.error({ err }, serverReady ? 'Uncaught exception (kept process alive)' : 'Fatal startup error')
  if (!serverReady) process.exit(1)
})

const httpServer = createServer(app)
setupSocket(httpServer)

// Load the persisted social graph (friends / requests / blocks) into memory
// before we accept connections, so presence + friend checks are correct from the
// first request. Self-guarded — a DB hiccup just means in-memory-only, never a
// boot failure.
await SocialService.init()

httpServer.listen(PORT, () => {
  serverReady = true
  logger.info({ port: PORT }, 'Numbskull server listening')
})
