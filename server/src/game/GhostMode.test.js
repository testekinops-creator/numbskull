import { describe, it, expect, beforeEach } from 'vitest'
import { saveGhostRun, getGhostRun, compareToGhost } from './GhostMode.js'

describe('GhostMode', () => {
  beforeEach(() => {
    saveGhostRun({ playerId: 'p1', mode: 'GTN', guesses: [50,75,62,56,59,60], timeMs: 8000, won: true, secret: '60' })
  })

  it('saves a ghost run', () => {
    const ghost = getGhostRun('p1', 'GTN')
    expect(ghost).not.toBeNull()
    expect(ghost.totalGuesses).toBe(6)
  })

  it('returns null for non-existent ghost', () => {
    expect(getGhostRun('nobody', 'GTN')).toBeNull()
  })

  it('does not save if new run is worse', () => {
    saveGhostRun({ playerId: 'p1', mode: 'GTN', guesses: [1,2,3,4,5,6,7,8,9], timeMs: 20000, won: true, secret: '9' })
    const ghost = getGhostRun('p1', 'GTN')
    expect(ghost.totalGuesses).toBe(6)
  })

  it('overwrites ghost if new run is better (fewer guesses)', () => {
    saveGhostRun({ playerId: 'p1', mode: 'GTN', guesses: [50,75,62], timeMs: 3000, won: true, secret: '62' })
    const ghost = getGhostRun('p1', 'GTN')
    expect(ghost.totalGuesses).toBe(3)
  })

  it('compareToGhost returns beat=true for fewer guesses', () => {
    const result = compareToGhost('p1', 'GTN', [50,60], 2000)
    expect(result.hasGhost).toBe(true)
    expect(result.beat).toBe(true)
  })

  it('compareToGhost returns beat=false for more guesses', () => {
    const result = compareToGhost('p1', 'GTN', [1,2,3,4,5,6,7,8], 15000)
    expect(result.beat).toBe(false)
  })

  it('does not save a lost run', () => {
    saveGhostRun({ playerId: 'p9', mode: 'GTN', guesses: [1,2,3], timeMs: 5000, won: false, secret: '50' })
    expect(getGhostRun('p9', 'GTN')).toBeNull()
  })
})
