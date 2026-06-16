import { Router } from 'express'
import { z } from 'zod'
import { PushService, notificationFor } from '../services/PushService.js'
import { AuthService } from '../services/AuthService.js'
import { requireAuth } from '../middleware/auth.js'

export const pushRouter = Router()

const subSchema = z.object({
  endpoint: z.string().url(),
  keys:     z.object({ p256dh: z.string(), auth: z.string() }),
  // Browsers include extra fields (expirationTime); allow them through.
}).passthrough()

pushRouter.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const sub = subSchema.parse(req.body)
    await PushService.subscribe(req.userId, sub)
    res.json({ success: true, data: { subscribed: true } })
  } catch (err) { next(err) }
})

pushRouter.delete('/subscribe', requireAuth, async (req, res, next) => {
  try {
    await PushService.unsubscribe(req.userId)
    res.json({ success: true, data: { subscribed: false } })
  } catch (err) { next(err) }
})

pushRouter.get('/vapid-key', (_req, res) => {
  res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY || null } })
})

// Fire the caller's OWN most-played-game notification right now — handy for
// verifying the whole pipeline end-to-end without waiting for the daily job.
pushRouter.post('/test', requireAuth, async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.userId)
    const ok = await PushService.sendToUser(req.userId, notificationFor(user))
    res.json({ success: true, data: { sent: ok } })
  } catch (err) { next(err) }
})
