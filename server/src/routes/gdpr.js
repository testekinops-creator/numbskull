import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { AuthService } from '../services/AuthService.js'
import { SocialService } from '../services/SocialService.js'
import { ReplayTheater } from '../services/ReplayTheater.js'

export const gdprRouter = Router()

gdprRouter.get('/export', requireAuth, (req, res) => {
  const user    = AuthService.getUser(req.userId)
  const friends = SocialService.getFriends(req.userId)
  const replays = ReplayTheater.getPlayerReplays(req.userId)

  const export_ = {
    exportedAt: new Date().toISOString(),
    user: AuthService.publicProfile(user),
    friends: friends.map(f => ({ id: f.id, username: f.username, friendSince: f.friendSince })),
    replays: replays.map(r => ({ id: r.id, mode: r.mode, guessCount: r.guessCount, won: r.won, createdAt: r.createdAt })),
  }

  res.setHeader('Content-Disposition', `attachment; filename="numbskull-data-${req.userId}.json"`)
  res.setHeader('Content-Type', 'application/json')
  res.json(export_)
})

gdprRouter.delete('/account', requireAuth, (req, res) => {
  AuthService.updateUser(req.userId, {
    email: null, username: '[deleted]', passwordHash: null, deleted: true,
  })
  res.json({ success: true, data: { message: 'Account scheduled for deletion.' } })
})
