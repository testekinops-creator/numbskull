import { describe, it, expect, beforeEach } from 'vitest'
import { submitScore, getLeaderboard, getPlayerRank } from './Leaderboard.js'

describe('Leaderboard', () => {
  it('returns empty board initially', () => {
    expect(getLeaderboard('gtn_alltime')).toEqual([])
  })

  it('adds a score to gtn_alltime', () => {
    submitScore({ playerId: 'p1', playerName: 'Alice', mode: 'GTN', score: 90, attempts: 5 })
    const board = getLeaderboard('gtn_alltime')
    expect(board.find(e => e.playerId === 'p1')).toBeTruthy()
  })

  it('sorts by score descending', () => {
    submitScore({ playerId: 'p2', playerName: 'Bob',   mode: 'GTN', score: 50, attempts: 8 })
    submitScore({ playerId: 'p3', playerName: 'Carol', mode: 'GTN', score: 95, attempts: 4 })
    const board = getLeaderboard('gtn_alltime')
    expect(board[0].score).toBeGreaterThanOrEqual(board[1]?.score ?? -Infinity)
  })

  it('updates existing player if new score is higher', () => {
    submitScore({ playerId: 'p4', playerName: 'Dave', mode: 'GTN', score: 60, attempts: 7 })
    submitScore({ playerId: 'p4', playerName: 'Dave', mode: 'GTN', score: 80, attempts: 5 })
    const board = getLeaderboard('gtn_alltime')
    const entry = board.find(e => e.playerId === 'p4')
    expect(entry.score).toBe(80)
  })

  it('does not update if new score is lower', () => {
    submitScore({ playerId: 'p5', playerName: 'Eve', mode: 'BC', score: 75, attempts: 6 })
    submitScore({ playerId: 'p5', playerName: 'Eve', mode: 'BC', score: 40, attempts: 9 })
    const board = getLeaderboard('bc_alltime')
    const entry = board.find(e => e.playerId === 'p5')
    expect(entry.score).toBe(75)
  })

  it('getPlayerRank returns 1-based rank', () => {
    submitScore({ playerId: 'top', playerName: 'Top', mode: 'GTN', score: 999, attempts: 1 })
    const rank = getPlayerRank('top', 'gtn_alltime')
    expect(rank).toBe(1)
  })

  it('getPlayerRank returns null for unknown player', () => {
    expect(getPlayerRank('nobody', 'gtn_alltime')).toBeNull()
  })

  it('daily leaderboard is keyed by date', () => {
    submitScore({ playerId: 'p6', playerName: 'Frank', mode: 'GTN', score: 85, attempts: 4, date: '2026-06-01' })
    const board = getLeaderboard('daily', { date: '2026-06-01' })
    expect(board.find(e => e.playerId === 'p6')).toBeTruthy()
    expect(getLeaderboard('daily', { date: '2026-06-02' })).toEqual([])
  })
})
