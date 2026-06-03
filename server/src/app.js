import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { gameRouter } from './routes/game.js'
import { authRouter } from './routes/auth.js'
import { engagementRouter } from './routes/engagement.js'
import { usersRouter } from './routes/users.js'
import { replaysRouter } from './routes/replays.js'
import { pushRouter } from './routes/push.js'
import { gdprRouter } from './routes/gdpr.js'
import { adminRouter } from './routes/admin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { logger } from './utils/logger.js'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', generalLimiter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/game', gameRouter)
app.use('/api', engagementRouter)
app.use('/api/users', usersRouter)
app.use('/api/replays', replaysRouter)
app.use('/api/push', pushRouter)
app.use('/api/gdpr', gdprRouter)
app.use('/api/admin', adminRouter)

app.use(errorHandler)

export default app
