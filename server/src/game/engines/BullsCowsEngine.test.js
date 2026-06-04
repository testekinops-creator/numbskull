import { describe, it, expect } from 'vitest'
import { BullsCowsEngine } from './BullsCowsEngine.js'

describe('BullsCowsEngine (6 digits, duplicates allowed)', () => {
  it('generates a valid 6-digit secret', () => {
    const engine = new BullsCowsEngine()
    expect(/^\d{6}$/.test(engine.secret)).toBe(true)
  })

  it('rejects guesses that are not exactly 6 digits', () => {
    const engine = new BullsCowsEngine()
    expect(engine.evaluate('12345').valid).toBe(false)
    expect(engine.evaluate('1234567').valid).toBe(false)
    expect(engine.evaluate('abcdef').valid).toBe(false)
  })

  it('ALLOWS repeated digits in a guess', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    const result = engine.evaluate('111111')
    expect(result.valid).toBe(true)
  })

  it('scores 6 bulls on correct guess', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    const result = engine.evaluate('123456')
    expect(result.bulls).toBe(6)
    expect(result.cows).toBe(0)
    expect(result.correct).toBe(true)
    expect(result.won).toBe(true)
  })

  it('scores all cows for a full rotation', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    const result = engine.evaluate('234561') // every digit present, none in place
    expect(result.bulls).toBe(0)
    expect(result.cows).toBe(6)
  })

  it('scores 0/0 for no matches', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    const result = engine.evaluate('789078')  // none of 7,8,9,0 are in secret
    expect(result.bulls).toBe(0)
    expect(result.cows).toBe(0)
  })

  it('handles duplicates in the secret correctly', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '112233'
    // guess 123123: pos0 '1'=bull, pos1 '2' vs '1' no, pos2 '3' vs '2' no,
    //               pos3 '1' vs '2' no, pos4 '2' vs '3' no, pos5 '3'=bull
    // bulls: pos0(1) and pos5(3) → 2 bulls
    const result = engine.evaluate('123123')
    expect(result.bulls).toBe(2)
    // non-bull secret digits {1:1,2:2,3:1}, non-bull guess {2:2,3:1,1:1}
    // cows = min(1,1)+min(2,2)+min(1,1) = 1+2+1 = 4
    expect(result.cows).toBe(4)
  })

  it('cow count never exceeds available duplicates', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '100000'
    // guess 011111: '1' appears once in secret (pos0, which is a miss here),
    // guess has '1' at pos1 → 1 cow for the digit 1; zeros: secret has five 0s
    const result = engine.evaluate('011111')
    // pos0 guess '0' vs secret '1' miss; pos1 '1' vs '0' miss; rest '1' vs '0' miss
    // bulls = 0. digit 1: guess count 5, secret count 1 → cow 1. digit 0: guess 1, secret 5 → cow 1
    expect(result.bulls).toBe(0)
    expect(result.cows).toBe(2)
  })

  it('static score helper works', () => {
    const { bulls, cows } = BullsCowsEngine.score('123456', '123456')
    expect(bulls).toBe(6)
    expect(cows).toBe(0)
  })

  it('marks bull positions; cows are NOT revealed per-position', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    const result = engine.evaluate('120000') // pos0 bull, pos1 bull, rest miss/cow-but-hidden
    expect(result.positions[0]).toBe('bull')
    expect(result.positions[1]).toBe('bull')
    // non-bull positions are 'miss' (cows hidden)
    expect(result.positions.slice(2).every(p => p === 'miss')).toBe(true)
  })

  it('ends game when max guesses reached', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    engine.maxGuesses = 2
    engine.evaluate('000000')
    const result = engine.evaluate('111111')
    expect(result.over).toBe(true)
    expect(result.won).toBe(false)
    expect(result.secret).toBe('123456')
  })

  it('rejects guesses after game over', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    engine.evaluate('123456')
    const result = engine.evaluate('123456')
    expect(result.valid).toBe(false)
  })

  it('tracks attempts', () => {
    const engine = new BullsCowsEngine()
    engine.secret = '123456'
    engine.evaluate('000000')
    engine.evaluate('111111')
    const result = engine.evaluate('222222')
    expect(result.attempts).toBe(3)
  })
})
