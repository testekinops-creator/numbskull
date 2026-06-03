import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { AuthService } from '../services/AuthService.js'
import { roomManager } from '../game/RoomManager.js'

export const adminRouter = Router()

function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only', status: 403 } })
  }
  next()
}

adminRouter.use(requireAuth, requireAdmin)

const announcements = []

// ── Server stats ───────────────────────────────────────────────────────────
adminRouter.get('/stats', (_req, res) => {
  const rooms = roomManager.listPublic()
  res.json({
    success: true,
    data: {
      activeRooms:    rooms.length,
      playingRooms:   rooms.filter(r => r.phase === 'PLAYING').length,
      uptime:         process.uptime(),
      memoryMB:       Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion:    process.version,
    },
  })
})

// ── Ban / unban ────────────────────────────────────────────────────────────
adminRouter.post('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.params.id)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
    await AuthService.updateUser(req.params.id, { banned: true, bannedAt: new Date() })
    res.json({ success: true, data: { banned: true } })
  } catch (err) { next(err) }
})

adminRouter.post('/users/:id/unban', async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.params.id)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
    await AuthService.updateUser(req.params.id, { banned: false, bannedAt: null })
    res.json({ success: true, data: { banned: false } })
  } catch (err) { next(err) }
})

// ── Announcements ──────────────────────────────────────────────────────────
adminRouter.get('/announcements', (_req, res) => {
  res.json({ success: true, data: { announcements } })
})

adminRouter.post('/announcements', (req, res, next) => {
  try {
    const { message, type = 'info' } = z.object({
      message: z.string().min(1).max(280),
      type:    z.enum(['info', 'warning', 'maintenance']).default('info'),
    }).parse(req.body)
    const ann = { id: Date.now(), message, type, createdAt: new Date().toISOString() }
    announcements.unshift(ann)
    if (announcements.length > 5) announcements.pop()
    res.status(201).json({ success: true, data: ann })
  } catch (err) { next(err) }
})

adminRouter.delete('/announcements/:id', (req, res) => {
  const idx = announcements.findIndex(a => String(a.id) === req.params.id)
  if (idx !== -1) announcements.splice(idx, 1)
  res.json({ success: true, data: null })
})

export { announcements }
