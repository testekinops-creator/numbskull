import { Router } from 'express'
import { z } from 'zod'
import { AuthService } from '../services/AuthService.js'
import { SocialService } from '../services/SocialService.js'
import { ReplayTheater } from '../services/ReplayTheater.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { getWatchableRoomForUser, emitToUser, isUserOnline } from '../socket/index.js'

// Resolve a user's display name for live notifications (best-effort, never throws).
async function _nameOf(userId) {
  try { return (await AuthService.getUser(userId))?.username || 'Someone' }
  catch { return 'Someone' }
}

export const usersRouter = Router()

// ── Search users by username ───────────────────────────────────────────────
usersRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.json({ success: true, data: { users: [] } })
    const results = await AuthService.searchUsers(q, req.userId)
    const enriched = results.map(u => ({
      ...u,
      isFriend: SocialService.areFriends(req.userId, u.id),
    }))
    res.json({ success: true, data: { users: enriched } })
  } catch (err) { next(err) }
})

// ── Friends ─── (must be registered BEFORE /:id so "me" isn't treated as id) ─
usersRouter.get('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const friends = await SocialService.getFriends(req.userId)
    // Enrich with the room each friend is currently playing in (if any + they
    // allow being watched) so the UI can offer a direct "Watch" button, plus
    // their live online status for the presence dot.
    const enriched = friends.map(f => ({
      ...f,
      liveRoomId: getWatchableRoomForUser(f.id),
      online: isUserOnline(f.id),
    }))
    res.json({ success: true, data: { friends: enriched } })
  } catch (err) { next(err) }
})

usersRouter.get('/me/friend-requests', requireAuth, async (req, res, next) => {
  try {
    const requests = await SocialService.getPendingRequests(req.userId)
    res.json({ success: true, data: { requests } })
  } catch (err) { next(err) }
})

// ── Update own profile ─────────────────────────────────────────────────────
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = z.object({ username: z.string().min(2).max(20).optional() })
    const patch = allowed.parse(req.body)
    const updated = await AuthService.updateUser(req.userId, patch)
    res.json({ success: true, data: { user: AuthService.publicProfile(updated) } })
  } catch (err) { next(err) }
})

// ── Public profile ─────────────────────────────────────────────────────────
usersRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.params.id)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found', status: 404 } })
    const profile = AuthService.publicProfile(user)
    const isSelf = req.userId === user.id
    res.json({ success: true, data: { user: profile, isSelf } })
  } catch (err) { next(err) }
})

usersRouter.post('/:id/friend', requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id
    const result = SocialService.sendFriendRequest(req.userId, targetId)
    const myName = await _nameOf(req.userId)
    if (result.status === 'pending') {
      // Push the request live so the recipient gets an Accept/Reject card anywhere
      // (lobby, home, mid-game). If they're offline it's a no-op — they'll still see
      // it in their Requests tab on next visit.
      emitToUser(targetId, 'friend:incoming', { fromUserId: req.userId, fromName: myName })
    } else if (result.status === 'accepted') {
      // Mutual request (they'd already sent one) auto-matched → tell both sides live.
      const theirName = await _nameOf(targetId)
      emitToUser(targetId, 'friend:accepted', { userId: req.userId, name: myName })
      emitToUser(req.userId, 'friend:accepted', { userId: targetId, name: theirName })
    }
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

usersRouter.post('/:id/friend/accept', requireAuth, async (req, res, next) => {
  try {
    const senderId = req.params.id
    const result = SocialService.acceptFriendRequest(req.userId, senderId)
    // Notify the original sender live that I accepted → "you're now friends".
    const myName = await _nameOf(req.userId)
    emitToUser(senderId, 'friend:accepted', { userId: req.userId, name: myName })
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
