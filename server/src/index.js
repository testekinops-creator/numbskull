import { createServer } from 'http'
import app from './app.js'
import { setupSocket } from './socket/index.js'
import { logger } from './utils/logger.js'

const PORT = process.env.PORT || 4000

const httpServer = createServer(app)
setupSocket(httpServer)

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Numbskull server listening')
})
