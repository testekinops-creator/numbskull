import { describe, it, expect } from 'vitest'
import { getDailyChallenge, todaysChallenge } from './DailyChallenge.js'

describe('DailyChallenge', () => {
  it('returns same challenge for same date', () => {
    const a = getDailyChallenge('2026-06-02')
    const b = getDailyChallenge('2026-06-02')
    expect(a.secret).toBe(b.secret)
    expect(a.mode).toBe(b.mode)
  })

  it('returns different challenges for different dates', () => {
    const a = getDailyChallenge('2026-06-02')
    const b = getDailyChallenge('2026-06-03')
    expect(a.secret !== b.secret || a.mode !== b.mode).toBe(true)
  })

  it('GTN secret is a number 1-100', () => {
    for (let d = 1; d <= 30; d++) {
      const ch = getDailyChallenge(`2026-06-${String(d).padStart(2,'0')}`)
      if (ch.mode === 'GTN') {
        const n = parseInt(ch.secret, 10)
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(100)
      }
    }
  })

  it('BC secret has 4 unique digits', () => {
    for (let d = 1; d <= 30; d++) {
      const ch = getDailyChallenge(`2026-06-${String(d).padStart(2,'0')}`)
      if (ch.mode === 'BC') {
        expect(/^\d{4}$/.test(ch.secret)).toBe(true)
        expect(new Set(ch.secret).size).toBe(4)
      }
    }
  })

  it('returns a challenge for today', () => {
    const ch = todaysChallenge()
    expect(ch.mode).toMatch(/GTN|BC/)
    expect(ch.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
