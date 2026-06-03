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
})
