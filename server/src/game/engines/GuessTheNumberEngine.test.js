import { describe, it, expect } from 'vitest'
import { GuessTheNumberEngine } from './GuessTheNumberEngine.js'

describe('GuessTheNumberEngine', () => {
  it('creates a secret in range', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    expect(engine.secret).toBeGreaterThanOrEqual(1)
    expect(engine.secret).toBeLessThanOrEqual(100)
  })

  it('rejects out-of-range guesses', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    expect(engine.evaluate(0).valid).toBe(false)
    expect(engine.evaluate(101).valid).toBe(false)
    expect(engine.evaluate(-5).valid).toBe(false)
  })

  it('rejects non-numeric guesses', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    expect(engine.evaluate('abc').valid).toBe(false)
  })

  it('returns correct direction for low guess', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 70
    const result = engine.evaluate(30)
    expect(result.valid).toBe(true)
    expect(result.direction).toBe('higher')
    expect(result.correct).toBe(false)
  })

  it('returns correct direction for high guess', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 30
    const result = engine.evaluate(70)
    expect(result.valid).toBe(true)
    expect(result.direction).toBe('lower')
    expect(result.correct).toBe(false)
  })

  it('detects correct guess', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 42
    const result = engine.evaluate(42)
    expect(result.correct).toBe(true)
    expect(result.over).toBe(true)
    expect(result.won).toBe(true)
    expect(result.secret).toBe(42)
  })

  it('tracks attempt count', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 50
    engine.evaluate(25)
    engine.evaluate(75)
    const result = engine.evaluate(50)
    expect(result.attempts).toBe(3)
  })

  it('proximity is 1 for correct guess', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 42
    const result = engine.evaluate(42)
    expect(result.proximity).toBe(1)
  })

  it('proximity is lower for distant guess', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 50
    const close   = engine.evaluate(49)
    const distant = new GuessTheNumberEngine({ range: 100 })
    distant.secret = 50
    const far = distant.evaluate(1)
    expect(close.proximity).toBeGreaterThan(far.proximity)
  })

  it('rejects guesses after game over', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 42
    engine.evaluate(42)
    const result = engine.evaluate(42)
    expect(result.valid).toBe(false)
    expect(result.over).toBe(true)
  })

  it('exposes optimalMoves on win', () => {
    const engine = new GuessTheNumberEngine({ range: 100 })
    engine.secret = 42
    const result = engine.evaluate(42)
    expect(result.optimalMoves).toBe(7) // ceil(log2(101)) = 7
  })

  it('defaults to range 100 for unknown range', () => {
    const engine = new GuessTheNumberEngine({ range: 999 })
    expect(engine.range).toBe(100)
  })

  it('accepts range 500', () => {
    const engine = new GuessTheNumberEngine({ range: 500 })
    expect(engine.range).toBe(500)
    expect(engine.secret).toBeGreaterThanOrEqual(1)
    expect(engine.secret).toBeLessThanOrEqual(500)
  })
})
