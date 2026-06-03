import { describe, it, expect } from 'vitest'
import { ReplayTheater } from './ReplayTheater.js'

describe('ReplayTheater', () => {
  it('saves and retrieves a replay', () => {
    const id = ReplayTheater.saveReplay({ playerId: 'p1', playerName: 'Alice', mode: 'GTN', guesses: [50,75,62], won: true, timeMs: 5000, optimalMoves: 7 })
    const r = ReplayTheater.getReplay(id)
    expect(r).not.toBeNull()
    expect(r.playerName).toBe('Alice')
  })

  it('increments view count on watchReplay', () => {
    const id = ReplayTheater.saveReplay({ playerId: 'p2', playerName: 'Bob', mode: 'BC', guesses: ['1234','5678','1234'], won: true, timeMs: 6000, optimalMoves: 5 })
    ReplayTheater.watchReplay(id)
    ReplayTheater.watchReplay(id)
    expect(ReplayTheater.getReplay(id).views).toBe(2)
  })

  it('features optimal GTN runs', () => {
    ReplayTheater.saveReplay({ playerId: 'p3', playerName: 'Carol', mode: 'GTN', guesses: [50,75,62,56,59,60,61], won: true, timeMs: 8000, optimalMoves: 7 })
    const featured = ReplayTheater.getFeatured()
    expect(featured.length).toBeGreaterThan(0)
  })

  it('does not feature lost games', () => {
    const countBefore = ReplayTheater.getFeatured().length
    ReplayTheater.saveReplay({ playerId: 'p4', playerName: 'Dave', mode: 'GTN', guesses: [1,2,3,4,5,6,7,8], won: false, timeMs: 15000, optimalMoves: 7 })
    expect(ReplayTheater.getFeatured().length).toBe(countBefore)
  })

  it('returns player replays', () => {
    ReplayTheater.saveReplay({ playerId: 'p5', playerName: 'Eve', mode: 'BC', guesses: ['1234'], won: false, timeMs: 2000 })
    const reps = ReplayTheater.getPlayerReplays('p5')
    expect(reps.length).toBeGreaterThan(0)
  })

  it('returns null for unknown replay', () => {
    expect(ReplayTheater.getReplay('nonexistent')).toBeNull()
  })
})
