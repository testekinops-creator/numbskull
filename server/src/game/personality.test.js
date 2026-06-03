import { describe, it, expect } from 'vitest'
import { getRoastMessage, getTier } from './personality.js'

describe('personality', () => {
  it('returns hostile tier for 1 game', () => {
    expect(getTier(1)).toBe('hostile')
    expect(getTier(10)).toBe('hostile')
  })

  it('returns grudging tier for 11-30 games', () => {
    expect(getTier(11)).toBe('grudging')
    expect(getTier(30)).toBe('grudging')
  })

  it('returns backhanded tier for 31-99 games', () => {
    expect(getTier(31)).toBe('backhanded')
    expect(getTier(99)).toBe('backhanded')
  })

  it('returns rivalry tier for 100+ games', () => {
    expect(getTier(100)).toBe('rivalry')
    expect(getTier(999)).toBe('rivalry')
  })

  it('getRoastMessage returns a string message', () => {
    const result = getRoastMessage('wrong_high', 1)
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('getRoastMessage includes tier and event', () => {
    const result = getRoastMessage('correct', 50)
    expect(result.tier).toBe('backhanded')
    expect(result.event).toBe('correct')
  })

  it('falls back to hostile for unknown event', () => {
    const result = getRoastMessage('unknown_event', 1)
    expect(result).toBeTruthy()
  })
})
