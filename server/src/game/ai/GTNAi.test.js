import { describe, it, expect } from 'vitest'
import { GTNAi } from './GTNAi.js'

describe('GTNAi', () => {
  it('first binary guess is midpoint', () => {
    const ai = new GTNAi({ difficulty: 'hard', range: 100 })
    expect(ai.nextGuess()).toBe(50)
  })

  it('updates range on higher feedback', () => {
    const ai = new GTNAi({ difficulty: 'hard', range: 100 })
    ai.applyFeedback(50, 'higher')
    expect(ai.low).toBe(51)
    const next = ai.nextGuess()
    expect(next).toBeGreaterThan(50)
  })

  it('updates range on lower feedback', () => {
    const ai = new GTNAi({ difficulty: 'hard', range: 100 })
    ai.applyFeedback(50, 'lower')
    expect(ai.high).toBe(49)
    const next = ai.nextGuess()
    expect(next).toBeLessThan(50)
  })

  it('solves within 7 steps (binary search for 1-100)', () => {
    for (let secret = 1; secret <= 100; secret++) {
      const ai = new GTNAi({ difficulty: 'hard', range: 100 })
      let attempts = 0
      let found = false
      while (attempts < 20) {
        const guess = ai.nextGuess()
        attempts++
        if (guess === secret) { found = true; break }
        ai.applyFeedback(guess, guess < secret ? 'higher' : 'lower')
      }
      expect(found).toBe(true)
      expect(attempts).toBeLessThanOrEqual(7)
    }
  })

  it('easy mode stays in valid range', () => {
    const ai = new GTNAi({ difficulty: 'easy', range: 100 })
    for (let i = 0; i < 20; i++) {
      const g = ai.nextGuess()
      expect(g).toBeGreaterThanOrEqual(1)
      expect(g).toBeLessThanOrEqual(100)
    }
  })
})
