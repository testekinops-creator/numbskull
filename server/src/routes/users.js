import { Router } from 'express'
import { z } from 'zod'
import { AuthService } from '../services/AuthService.js'
import { SocialService } from '../services/SocialService.js'
import { ReplayTheater } from '../services/ReplayTheater.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'

export const usersRouter = Router()

// ── Search users by username ───────────────────────────────────────────────
usersRouter.get('/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.json({ success: true, data: { users: [] } })
  const results = AuthService.searchUsers(q, req.userId)
  // Annotate with friendship status
  const enriched = results.map(u => ({
    ...u,
    isFriend: SocialService.areFriends(req.userId, u.id),
  }))
  res.json({ success: true, data: { users: enriched } })
})

// ── Public profile ─────────────────────────────────────────────────────────
usersRouter.get('/:id', optionalAuth, (req, res) => {
  const user = AuthService.getUser(req.params.id)
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
  const profile = AuthService.publicProfile(user)
  const isSelf = req.userId === user.id
  res.json({ success: true, data: { user: profile, isSelf } })
})

// ── Update own profile ─────────────────────────────────────────────────────
usersRouter.patch('/me', requireAuth, (req, res) => {
  const allowed = z.object({ username: z.string().min(2).max(20).optional() })
  const patch = allowed.parse(req.body)
  const updated = AuthService.updateUser(req.userId, patch)
  res.json({ success: true, data: { user: AuthService.publicProfile(updated) } })
})

// ── Friends ────────────────────────────────────────────────────────────────
usersRouter.get('/me/friends', requireAuth, (req, res) => {
  const friends = SocialService.getFriends(req.userId)
  res.json({ success: true, data: { friends } })
})

usersRouter.get('/me/friend-requests', requireAuth, (req, res) => {
  const requests = SocialService.getPendingRequests(req.userId)
  res.json({ success: true, data: { requests } })
})

usersRouter.post('/:id/friend', requireAuth, (req, res, next) => {
  try {
    const result = SocialService.sendFriendRequest(req.userId, req.params.id)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

usersRouter.post('/:id/friend/accept', requireAuth, (req, res, next) => {
  try {
    const result = SocialService.acceptFriendRequest(req.userId, req.params.id)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

usersRouter.post('/:id/friend/decline', requireAuth, (req, res) => {
  SocialService.declineFriendRequest(req.userId, req.params.id)
  res.json({ success: true, data: { status: 'declined' } })
})

usersRouter.delete('/:id/friend', requireAuth, (req, res) => {
  SocialService.removeFriend(req.userId, req.params.id)
  res.json({ success: true, data: null })
})

// ── Block / Report ─────────────────────────────────────────────────────────
usersRouter.post('/:id/block', requireAuth, (req, res) => {
  SocialService.blockUser(req.userId, req.params.id)
  res.json({ success: true, data: { blocked: true } })
})

usersRouter.delete('/:id/block', requireAuth, (req, res) => {
  SocialService.unblockUser(req.userId, req.params.id)
  res.json({ success: true, data: { blocked: false } })
})

usersRouter.post('/:id/report', requireAuth, (req, res, next) => {
  try {
    const { reason, details } = z.object({ reason: z.string().min(1).max(50), details: z.string().max(500).optional() }).parse(req.body)
    const result = SocialService.reportUser(req.userId, req.params.id, reason, details)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

// ── Replays ────────────────────────────────────────────────────────────────
usersRouter.get('/:id/replays', (req, res) => {
  const replays = ReplayTheater.getPlayerReplays(req.params.id)
  res.json({ success: true, data: { replays } })
})
