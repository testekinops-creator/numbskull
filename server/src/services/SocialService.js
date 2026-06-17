import { v4 as uuidv4 } from 'uuid'
import { AuthService } from './AuthService.js'
import { prisma } from '../config/prisma.js'
import { logger } from '../utils/logger.js'

// In-memory cache of the social graph — the source of truth for the SYNC reads
// the socket layer needs (areFriends / getFriendIds / isBlocked must answer
// without awaiting). It is hydrated from Postgres on boot (`init`) and kept in
// step with every mutation, while writes are ALSO persisted to the DB so the
// graph survives restarts and deploys. Previously these maps were the only copy,
// so every redeploy wiped everyone's friends.
const friendships = new Map()   // sortedKey "a:b" → { a, b, since }
const requests    = new Map()   // "from→to"       → { from, to, sentAt }
const blocks      = new Map()   // blockerId        → Set<blockedId>
const reports     = []

let _hydrated = false

// Fire-and-forget DB write. A duplicate-key conflict (P2002) just means the row
// already exists — the cache already guarded it, so that's fine; anything else
// is logged but never throws into the (sync) caller.
function _persist(promise, ctx) {
  Promise.resolve(promise).catch(e => {
    if (e?.code === 'P2002' || e?.code === 'P2025') return  // already-exists / not-found: harmless
    logger.warn({ err: e?.message, ctx }, 'SocialService DB persist failed (cache is still correct)')
  })
}

export const SocialService = {
  // Load the persisted graph into memory before the server accepts traffic.
  // Non-fatal: if the DB is unreachable we simply run in-memory only.
  async init() {
    if (_hydrated) return
    try {
      const [fs, rq, bl] = await Promise.all([
        prisma.friendship.findMany(),
        prisma.friendRequest.findMany(),
        prisma.userBlock.findMany(),
      ])
      for (const f of fs) {
        friendships.set(_friendKey(f.userAId, f.userBId), { a: f.userAId, b: f.userBId, since: f.createdAt.getTime() })
      }
      for (const r of rq) {
        requests.set(_reqKey(r.fromId, r.toId), { from: r.fromId, to: r.toId, sentAt: r.createdAt.getTime() })
      }
      for (const b of bl) {
        if (!blocks.has(b.blockerId)) blocks.set(b.blockerId, new Set())
        blocks.get(b.blockerId).add(b.blockedId)
      }
      _hydrated = true
      logger.info({ friendships: fs.length, requests: rq.length, blocks: bl.length }, 'SocialService hydrated from DB')
    } catch (e) {
      logger.error({ err: e?.message }, 'SocialService hydration failed — running in-memory only until next restart')
    }
  },

  sendFriendRequest(fromId, toId) {
    if (fromId === toId) throw _err('Cannot add yourself', 400, 'SELF_FRIEND')
    if (this.areFriends(fromId, toId)) throw _err('Already friends', 409, 'ALREADY_FRIENDS')
    if (this.isBlocked(fromId, toId) || this.isBlocked(toId, fromId)) throw _err('Cannot send request', 403, 'BLOCKED')

    const key = _reqKey(fromId, toId)
    if (requests.has(key)) throw _err('Request already sent', 409, 'ALREADY_SENT')

    const mirror = _reqKey(toId, fromId)
    if (requests.has(mirror)) {
      // They'd already requested us → auto-accept. Clear their pending row + persist the friendship.
      requests.delete(mirror)
      _persist(prisma.friendRequest.deleteMany({ where: { fromId: toId, toId: fromId } }), 'req.delete(mirror)')
      this._makeFriends(fromId, toId)
      return { status: 'accepted' }
    }

    requests.set(key, { from: fromId, to: toId, sentAt: Date.now() })
    _persist(prisma.friendRequest.create({ data: { fromId, toId } }), 'req.create')
    return { status: 'pending' }
  },

  acceptFriendRequest(toId, fromId) {
    const key = _reqKey(fromId, toId)
    if (!requests.has(key)) throw _err('No pending request', 404, 'NO_REQUEST')
    requests.delete(key)
    _persist(prisma.friendRequest.deleteMany({ where: { fromId, toId } }), 'req.delete(accept)')
    this._makeFriends(fromId, toId)
    return { status: 'accepted' }
  },

  declineFriendRequest(toId, fromId) {
    const key = _reqKey(fromId, toId)
    requests.delete(key)
    _persist(prisma.friendRequest.deleteMany({ where: { fromId, toId } }), 'req.delete(decline)')
    return { status: 'declined' }
  },

  removeFriend(userId, friendId) {
    friendships.delete(_friendKey(userId, friendId))
    const [userAId, userBId] = _sortedPair(userId, friendId)
    _persist(prisma.friendship.deleteMany({ where: { userAId, userBId } }), 'friendship.delete')
  },

  areFriends(a, b) { return friendships.has(_friendKey(a, b)) },

  // Sync list of a user's friend ids (for presence fan-out).
  getFriendIds(userId) {
    const ids = []
    for (const [, d] of friendships) {
      if (d.a === userId) ids.push(d.b)
      else if (d.b === userId) ids.push(d.a)
    }
    return ids
  },

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
    _persist(prisma.userBlock.create({ data: { blockerId: userId, blockedId: targetId } }), 'block.create')
    this.removeFriend(userId, targetId)               // also persists the friendship delete
    // Drop any pending request in either direction (cache + DB).
    requests.delete(_reqKey(userId, targetId))
    requests.delete(_reqKey(targetId, userId))
    _persist(prisma.friendRequest.deleteMany({
      where: { OR: [{ fromId: userId, toId: targetId }, { fromId: targetId, toId: userId }] },
    }), 'req.delete(block)')
  },

  unblockUser(userId, targetId) {
    blocks.get(userId)?.delete(targetId)
    _persist(prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: targetId } }), 'block.delete')
  },

  isBlocked(byId, targetId) {
    return blocks.get(byId)?.has(targetId) ?? false
  },

  reportUser(reporterId, targetId, reason, details = '') {
    // Reports are an admin signal only (not surfaced in-app yet) → kept in memory.
    reports.push({ id: uuidv4(), reporterId, targetId, reason, details, createdAt: Date.now() })
    return { reported: true }
  },

  _makeFriends(a, b) {
    friendships.set(_friendKey(a, b), { a, b, since: Date.now() })
    const [userAId, userBId] = _sortedPair(a, b)
    _persist(prisma.friendship.create({ data: { userAId, userBId } }), 'friendship.create')
  },
}

function _sortedPair(a, b) { return [a, b].sort() }
function _friendKey(a, b) { return _sortedPair(a, b).join(':') }
function _reqKey(from, to)  { return `${from}→${to}` }
function _err(msg, status, code) {
  const e = new Error(msg); e.status = status; e.code = code; return e
}
