import { describe, it, expect } from 'vitest'
import { NumberChainEngine } from './NumberChainEngine.js'

describe('NumberChainEngine', () => {
  it('initialises with start and target', () => {
    const e = new NumberChainEngine({ startValue: 5, target: 20 })
    expect(e.current).toBe(5)
    expect(e.target).toBe(20)
  })

  it('applies + correctly', () => {
    const e = new NumberChainEngine({ startValue: 5, target: 20 })
    const r = e.applyMove('+', 10)
    expect(r.valid).toBe(true)
    expect(r.after).toBe(15)
    expect(e.current).toBe(15)
  })

  it('applies * correctly', () => {
    const e = new NumberChainEngine({ startValue: 3, target: 30 })
    const r = e.applyMove('*', 10)
    expect(r.after).toBe(30)
  })

  it('detects win when target reached', () => {
    const e = new NumberChainEngine({ startValue: 5, target: 20 })
    const r = e.applyMove('+', 15)
    expect(r.reached).toBe(true)
    expect(r.won).toBe(true)
    expect(r.over).toBe(true)
  })

  it('rejects non-integer division', () => {
    const e = new NumberChainEngine({ startValue: 10, target: 5 })
    expect(e.applyMove('/', 3).valid).toBe(false)
  })

  it('accepts clean division', () => {
    const e = new NumberChainEngine({ startValue: 12, target: 3 })
    const r = e.applyMove('/', 4)
    expect(r.valid).toBe(true)
    expect(r.after).toBe(3)
  })

  it('ends game when max moves reached', () => {
    const e = new NumberChainEngine({ startValue: 1, target: 999, maxMoves: 3 })
    e.applyMove('+', 1)
    e.applyMove('+', 1)
    const r = e.applyMove('+', 1)
    expect(r.over).toBe(true)
    expect(r.won).toBe(false)
  })

  it('rejects moves after game over', () => {
    const e = new NumberChainEngine({ startValue: 5, target: 5, maxMoves: 1 })
    e.applyMove('+', 5)
    expect(e.applyMove('+', 1).valid).toBe(false)
  })

  it('rejects invalid operators', () => {
    const e = new NumberChainEngine({ startValue: 10, target: 20 })
    expect(e.applyMove('%', 5).valid).toBe(false)
  })

  it('rejects operands out of range', () => {
    const e = new NumberChainEngine({ startValue: 10, target: 20 })
    expect(e.applyMove('+', 0).valid).toBe(false)
    expect(e.applyMove('+', 101).valid).toBe(false)
  })
})
