import { Router } from 'express'
import { ReplayTheater } from '../services/ReplayTheater.js'
import { optionalAuth } from '../middleware/auth.js'

export const replaysRouter = Router()

replaysRouter.get('/featured', (_req, res) => {
  const replays = ReplayTheater.getFeatured(10)
  res.json({ success: true, data: { replays } })
})

replaysRouter.get('/:id', optionalAuth, (req, res) => {
  const replay = ReplayTheater.watchReplay(req.params.id)
  if (!replay) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Replay not found', status: 404 } })
  res.json({ success: true, data: { replay } })
})
