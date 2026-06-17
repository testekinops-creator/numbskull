import { createServer } from 'http'
import app from './app.js'
import { setupSocket } from './socket/index.js'
import { logger } from './utils/logger.js'
import { SocialService } from './services/SocialService.js'

const PORT = process.env.PORT || 4000

// Crash guard: a stray rejection in an async callback (e.g. a per-turn timer)
// must NOT take down the whole process — that would disconnect every player in
// every room at once. Log it and keep serving. (We intentionally do NOT trap
// uncaughtException — a fatal startup error like EADDRINUSE should still exit
// rather than leave a zombie that isn't actually listening.)
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection (kept process alive)')
})

const httpServer = createServer(app)
setupSocket(httpServer)

// Load the persisted social graph (friends / requests / blocks) into memory
// before we accept connections, so presence + friend checks are correct from the
// first request. Self-guarded — a DB hiccup just means in-memory-only, never a
// boot failure.
await SocialService.init()

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Numbskull server listening')
})
