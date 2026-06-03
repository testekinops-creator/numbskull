import { describe, it, expect } from 'vitest'
import { BullsCowsEngine } from './BullsCowsEngine.js'

describe('BullsCowsEngine', () => {
  it('generates a valid 4-digit secret with unique digits', () => {
    const engine = new BullsCowsEngine()
    expect(/^\d{4}$/.test(engine.secret)).toBe(true)
    expect(new Set(engine.secret).size).toBe(4)
  })

  it('rejects non-4-digit guesses', () => {
    const engine = new BullsCowsEngine()
    expect(engine.evaluate('123').valid).toBe(false)
    expect(engine.evaluate('12345').valid).toBe(false)
    expect(engine.evaluate('abcd').valid).toBe(false)
  })

  it('rejects guesses with repeated digits', () => {
    const engine = new BullsCowsEngine()
    expect(engine.evaluate('1123').valid).toBe(false)
    expect(engine.evaluate('1111').valid).toBe(false)
  })

  it('scores 4 bulls on correct guess', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('1234')
    expect(result.bulls).toBe(4)
    expect(result.cows).toBe(0)
    expect(result.correct).toBe(true)
    expect(result.won).toBe(true)
  })

  it('scores 0 bulls 4 cows for all-wrong-position', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('2143')
    expect(result.bulls).toBe(0)
    expect(result.cows).toBe(4)
  })

  it('scores 0 bulls 0 cows for no matches', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('5678')
    expect(result.bulls).toBe(0)
    expect(result.cows).toBe(0)
  })

  it('scores 2 bulls 1 cow correctly', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    // 1 is in pos 0 ✓, 2 is in pos 1 ✓, 4 is not in pos 2, but in secret → 1 cow, 9 not in secret
    const result = engine.evaluate('1249')
    expect(result.bulls).toBe(2)
    expect(result.cows).toBe(1)
  })

  it('tracks attempts', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    engine.evaluate('5678')
    engine.evaluate('9012')
    const result = engine.evaluate('5678')
    expect(result.attempts).toBe(3)
  })

  it('ends game when max guesses reached', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    engine.maxGuesses = 2
    engine.evaluate('5678')
    const result = engine.evaluate('5670')
    expect(result.over).toBe(true)
    expect(result.won).toBe(false)
    expect(result.secret).toBe('1234')
  })

  it('rejects guesses after game over', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    engine.evaluate('1234')
    const result = engine.evaluate('1234')
    expect(result.valid).toBe(false)
  })

  it('static score helper works', () => {
    const { bulls, cows } = BullsCowsEngine.score('1234', '1234')
    expect(bulls).toBe(4)
    expect(cows).toBe(0)
  })

  it('returns positions array with bull/cow/miss', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    // 1 in pos0 = bull, 2 in pos1 = bull, 4 in pos2 = cow, 9 not in secret = miss
    const result = engine.evaluate('1249')
    expect(result.positions).toEqual(['bull', 'bull', 'cow', 'miss'])
  })

  it('positions all bull when correct', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('1234')
    expect(result.positions).toEqual(['bull', 'bull', 'bull', 'bull'])
  })

  it('positions all miss when no match', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('5678')
    expect(result.positions).toEqual(['miss', 'miss', 'miss', 'miss'])
  })

  it('provides remaining count', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '1234'
    const result = engine.evaluate('5678')
    expect(result.remaining).toBe(9)
  })
})
