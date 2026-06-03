import { v4 as uuidv4 } from 'uuid'
import { AuthService } from './AuthService.js'

const friendships = new Map()
const requests    = new Map()
const blocks      = new Map()
const reports     = []

export const SocialService = {
  sendFriendRequest(fromId, toId) {
    if (fromId === toId) throw _err('Cannot add yourself', 400, 'SELF_FRIEND')
    if (this.areFriends(fromId, toId)) throw _err('Already friends', 409, 'ALREADY_FRIENDS')
    if (this.isBlocked(fromId, toId) || this.isBlocked(toId, fromId)) throw _err('Cannot send request', 403, 'BLOCKED')

    const key = _reqKey(fromId, toId)
    if (requests.has(key)) throw _err('Request already sent', 409, 'ALREADY_SENT')

    const mirror = _reqKey(toId, fromId)
    if (requests.has(mirror)) {
      this._makeFriends(fromId, toId)
      requests.delete(mirror)
      return { status: 'accepted' }
    }

    requests.set(key, { from: fromId, to: toId, sentAt: Date.now() })
    return { status: 'pending' }
  },

  acceptFriendRequest(toId, fromId) {
    const key = _reqKey(fromId, toId)
    if (!requests.has(key)) throw _err('No pending request', 404, 'NO_REQUEST')
    this._makeFriends(fromId, toId)
    requests.delete(key)
    return { status: 'accepted' }
  },

  declineFriendRequest(toId, fromId) {
    const key = _reqKey(fromId, toId)
    requests.delete(key)
    return { status: 'declined' }
  },

  removeFriend(userId, friendId) {
    const key = _friendKey(userId, friendId)
    friendships.delete(key)
  },

  areFriends(a, b) { return friendships.has(_friendKey(a, b)) },

  async getFriends(userId) {
    const friends = []
    for (const [, data] of friendships) {
      if (data.a === userId || data.b === userId) {
        const otherId = data.a === userId ? data.b : data.a
        const profile = AuthService.publicProfile(await AuthService.getUser(otherId))
        if (profile) friends.push({ ...profile, friendSince: data.since })
      }
    }
    return friends
  },

  async getPendingRequests(userId) {
    const pending = []
    for (const [, req] of requests) {
      if (req.to === userId) {
        const profile = AuthService.publicProfile(await AuthService.getUser(req.from))
        if (profile) pending.push({ ...profile, sentAt: req.sentAt })
      }
    }
    return pending
  },

  blockUser(userId, targetId) {
    if (!blocks.has(userId)) blocks.set(userId, new Set())
    blocks.get(userId).add(targetId)
    this.removeFriend(userId, targetId)
    const key = _reqKey(userId, targetId)
    const mirror = _reqKey(targetId, userId)
    requests.delete(key)
    requests.delete(mirror)
  },

  unblockUser(userId, targetId) {
    blocks.get(userId)?.delete(targetId)
  },

  isBlocked(byId, targetId) {
    return blocks.get(byId)?.has(targetId) ?? false
  },

  reportUser(reporterId, targetId, reason, details = '') {
    reports.push({ id: uuidv4(), reporterId, targetId, reason, details, createdAt: Date.now() })
    return { reported: true }
  },

  _makeFriends(a, b) {
    friendships.set(_friendKey(a, b), { a, b, since: Date.now() })
  },
}

function _friendKey(a, b) { return [a, b].sort().join(':') }
function _reqKey(from, to)  { return `${from}→${to}` }
function _err(msg, status, code) {
  const e = new Error(msg); e.status = status; e.code = code; return e
}
