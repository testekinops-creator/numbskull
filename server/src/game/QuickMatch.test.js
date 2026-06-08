import { describe, it, expect, beforeEach } from 'vitest'
import { QuickMatchQueue } from './QuickMatch.js'

describe('QuickMatchQueue', () => {
  let q
  beforeEach(() => { q = new QuickMatchQueue() })

  it('returns waiting when no opponent yet', async () => {
    const result = await q.enqueue('p1', 'Alice', 'GTN')
    expect(result.waiting).toBe(true)
    expect(result.matched).toBe(false)
  })

  it('dequeue removes player from queue', async () => {
    await q.enqueue('p1', 'Alice', 'GTN')
    q.dequeue('p1')
    expect(q.size).toBe(0)
  })

  it('does not add duplicate player', async () => {
    await q.enqueue('p1', 'Alice', 'GTN')
    const second = await q.enqueue('p1', 'Alice', 'GTN')
    expect(second.waiting).toBe(true)
    expect(q.size).toBe(1)
  })

  it('matches two players and returns roomId', async () => {
    await q.enqueue('p1', 'Alice', 'GTN')
    const result = await q.enqueue('p2', 'Bob', 'GTN')
    expect(result.matched).toBe(true)
    expect(result.roomId).toBeTruthy()
    expect(q.size).toBe(0)
  })

  it('does not match different modes', async () => {
    await q.enqueue('p1', 'Alice', 'GTN')
    const result = await q.enqueue('p2', 'Bob', 'BC')
    expect(result.matched).toBe(false)
    expect(q.size).toBe(2)
  })

  it('does not self-match the same account across two sockets', async () => {
    // Same account key, two different socket ids (e.g. phone + laptop).
    await q.enqueue('sockA', 'Alice', 'GTN', 'medium', 'user1')
    const second = await q.enqueue('sockB', 'Alice', 'GTN', 'medium', 'user1')
    expect(second.matched).toBe(false)
    expect(second.waiting).toBe(true)
    expect(q.size).toBe(1)   // the duplicate account was not added
  })

  it('matches two distinct accounts (account key differs)', async () => {
    await q.enqueue('sockA', 'Alice', 'GTN', 'medium', 'user1')
    const result = await q.enqueue('sockB', 'Bob', 'GTN', 'medium', 'user2')
    expect(result.matched).toBe(true)
    expect(result.roomId).toBeTruthy()
    expect(q.size).toBe(0)
  })

  it('isQueued reflects membership', async () => {
    await q.enqueue('p1', 'Alice', 'GTN')
    expect(q.isQueued('p1')).toBe(true)
    q.dequeue('p1')
    expect(q.isQueued('p1')).toBe(false)
  })
})
