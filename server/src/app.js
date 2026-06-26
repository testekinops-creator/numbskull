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
import { shopRouter } from './routes/shop.js'
import { gdprRouter } from './routes/gdpr.js'
import { adminRouter } from './routes/admin.js'
import { turnRouter } from './routes/turn.js'
import { errorHandler } from './middleware/errorHandler.js'
import { logger } from './utils/logger.js'

const app = express()

// Behind Render/Vercel's proxy: trust the first proxy hop so req.ip is the real
// client IP (correct per-IP rate limiting) — but no more (so a client can't spoof
// X-Forwarded-For to dodge limits).
app.set('trust proxy', 1)

app.use(helmet())
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean)

// Only this project's own Vercel deploys (prod + preview), not *any* vercel.app site.
const VERCEL_ORIGIN = /^https:\/\/numbskull[a-z0-9-]*\.vercel\.app$/i

app.use(
  cors({
    origin: (origin, cb) => {
      // Exact match only — `startsWith` would let `https://allowed.com.evil.com` in.
      if (!origin || allowedOrigins.includes(origin) || VERCEL_ORIGIN.test(origin)) return cb(null, true)
      cb(new Error(`CORS: ${origin} not allowed`))
    },
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
app.use('/api/shop', shopRouter)
app.use('/api/gdpr', gdprRouter)
app.use('/api/admin', adminRouter)
app.use('/api/turn', turnRouter)

app.use(errorHandler)

export default app
