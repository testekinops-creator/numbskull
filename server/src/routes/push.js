import { Router } from 'express'
import { z } from 'zod'
import { PushService } from '../services/PushService.js'
import { requireAuth } from '../middleware/auth.js'

export const pushRouter = Router()

const subSchema = z.object({
  endpoint: z.string().url(),
  keys:     z.object({ p256dh: z.string(), auth: z.string() }),
})

pushRouter.post('/subscribe', requireAuth, (req, res, next) => {
  try {
    const sub = subSchema.parse(req.body)
    PushService.subscribe(req.userId, sub)
    res.json({ success: true, data: { subscribed: true } })
  } catch (err) { next(err) }
})

pushRouter.delete('/subscribe', requireAuth, (req, res) => {
  PushService.unsubscribe(req.userId)
  res.json({ success: true, data: { subscribed: false } })
})

pushRouter.get('/vapid-key', (_req, res) => {
  res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY || null } })
})
