import { describe, it, expect } from 'vitest'
import { CountdownEngine } from './CountdownEngine.js'

describe('CountdownEngine', () => {
  it('creates a target between 101 and 999', () => {
    const e = new CountdownEngine()
    expect(e.target).toBeGreaterThanOrEqual(101)
    expect(e.target).toBeLessThanOrEqual(999)
  })

  it('creates exactly 6 numbers', () => {
    const e = new CountdownEngine()
    expect(e.numbers).toHaveLength(6)
  })

  it('rejects expressions with invalid characters', () => {
    const e = new CountdownEngine()
    expect(e.submit('alert(1)').valid).toBe(false)
  })

  it('rejects numbers not in the set', () => {
    const e = new CountdownEngine()
    const badNum = 999
    const result = e.submit(String(badNum))
    if (!e.numbers.includes(badNum)) {
      expect(result.valid).toBe(false)
    }
  })

  it('accepts a correct expression matching the target', () => {
    const e = new CountdownEngine()
    e.target = 100
    e.numbers = [100, 2, 3, 4, 5, 6]
    const result = e.submit('100')
    expect(result.correct).toBe(true)
    expect(result.won).toBe(true)
    expect(result.diff).toBe(0)
  })

  it('tracks best score across multiple submissions', () => {
    const e = new CountdownEngine()
    e.target = 200
    e.numbers = [100, 50, 25, 10, 3, 1]
    e.submit('100')
    e.submit('100+50')
    expect(e.bestScore).toBe(150)
  })

  it('ends round on timeUp', () => {
    const e = new CountdownEngine()
    const result = e.timeUp()
    expect(result.over).toBe(true)
    expect(e.over).toBe(true)
  })

  it('rejects submissions after over', () => {
    const e = new CountdownEngine()
    e.over = true
    expect(e.submit('1').valid).toBe(false)
  })

  it('rejects non-integer results', () => {
    const e = new CountdownEngine()
    e.numbers = [1, 2, 3, 4, 5, 6]
    const result = e.submit('1+2/4')
    expect(result.valid).toBe(false)
  })

  it('exposes time remaining via getState', () => {
    const e = new CountdownEngine()
    const state = e.getState()
    expect(state.timeRemainingMs).toBeGreaterThan(0)
    expect(state.timeRemainingMs).toBeLessThanOrEqual(60_000)
  })
})
