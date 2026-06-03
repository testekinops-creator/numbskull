import { describe, it, expect, beforeEach } from 'vitest'
import { initBluff, canBluff, useBluff, clearBluff } from './BluffRound.js'

describe('BluffRound', () => {
  beforeEach(() => clearBluff('g1'))

  it('allows bluff after init', () => {
    initBluff('g1', 'p1')
    expect(canBluff('g1', 'p1')).toBe(true)
  })

  it('cannot bluff before init', () => {
    expect(canBluff('g1', 'nobody')).toBe(false)
  })

  it('useBluff returns faked result and marks used', () => {
    initBluff('g1', 'p1')
    const result = useBluff('g1', 'p1', { bulls: 2, cows: 1 })
    expect(result).not.toBeNull()
    expect(result.wasBluffed).toBe(true)
    expect(result.bulls).toBeGreaterThanOrEqual(0)
    expect(result.bulls).toBeLessThanOrEqual(4)
    expect(canBluff('g1', 'p1')).toBe(false)
  })

  it('cannot use bluff twice', () => {
    initBluff('g1', 'p1')
    useBluff('g1', 'p1', { bulls: 1, cows: 1 })
    const second = useBluff('g1', 'p1', { bulls: 1, cows: 1 })
    expect(second).toBeNull()
  })

  it('clearBluff removes all entries for game', () => {
    initBluff('g1', 'p1')
    initBluff('g1', 'p2')
    clearBluff('g1')
    expect(canBluff('g1', 'p1')).toBe(false)
    expect(canBluff('g1', 'p2')).toBe(false)
  })
})
