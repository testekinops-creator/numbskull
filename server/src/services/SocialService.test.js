import { describe, it, expect, beforeAll } from 'vitest'
import { SocialService } from './SocialService.js'
import { AuthService } from './AuthService.js'

let userA, userB, userC

beforeAll(async () => {
  const a = await AuthService.register({ email: 'soc_a@test.com', username: 'SocA', password: 'password1' })
  const b = await AuthService.register({ email: 'soc_b@test.com', username: 'SocB', password: 'password1' })
  const c = await AuthService.register({ email: 'soc_c@test.com', username: 'SocC', password: 'password1' })
  userA = a.user; userB = b.user; userC = c.user
})

describe('SocialService - Friends', () => {
  it('sends a friend request', () => {
    const result = SocialService.sendFriendRequest(userA.id, userB.id)
    expect(result.status).toBe('pending')
  })

  it('returns pending requests for recipient', () => {
    const reqs = SocialService.getPendingRequests(userB.id)
    expect(reqs.find(r => r.id === userA.id)).toBeTruthy()
  })

  it('accepts friend request and makes friends', () => {
    const result = SocialService.acceptFriendRequest(userB.id, userA.id)
    expect(result.status).toBe('accepted')
    expect(SocialService.areFriends(userA.id, userB.id)).toBe(true)
  })

  it('lists friends', () => {
    const friends = SocialService.getFriends(userA.id)
    expect(friends.find(f => f.id === userB.id)).toBeTruthy()
  })

  it('removes friend', () => {
    SocialService.removeFriend(userA.id, userB.id)
    expect(SocialService.areFriends(userA.id, userB.id)).toBe(false)
  })

  it('accepts mutual request (A→C, C→A = auto-accept)', () => {
    SocialService.sendFriendRequest(userA.id, userC.id)
    const result = SocialService.sendFriendRequest(userC.id, userA.id)
    expect(result.status).toBe('accepted')
    expect(SocialService.areFriends(userA.id, userC.id)).toBe(true)
  })

  it('rejects self-friend', () => {
    expect(() => SocialService.sendFriendRequest(userA.id, userA.id)).toThrow()
  })

  it('declines a friend request', () => {
    SocialService.sendFriendRequest(userB.id, userC.id)
    const result = SocialService.declineFriendRequest(userC.id, userB.id)
    expect(result.status).toBe('declined')
  })
})

describe('SocialService - Block/Report', () => {
  it('blocks a user', () => {
    SocialService.blockUser(userA.id, userB.id)
    expect(SocialService.isBlocked(userA.id, userB.id)).toBe(true)
  })

  it('unblocks a user', () => {
    SocialService.unblockUser(userA.id, userB.id)
    expect(SocialService.isBlocked(userA.id, userB.id)).toBe(false)
  })

  it('blocks prevent friend requests', () => {
    SocialService.blockUser(userB.id, userC.id)
    expect(() => SocialService.sendFriendRequest(userB.id, userC.id)).toThrow()
  })

  it('reports a user', () => {
    const result = SocialService.reportUser(userA.id, userB.id, 'harassment', 'spam')
    expect(result.reported).toBe(true)
  })
})
