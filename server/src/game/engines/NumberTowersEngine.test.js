import { describe, it, expect } from 'vitest'
import { NumberTowersEngine } from './NumberTowersEngine.js'

describe('NumberTowersEngine', () => {
  it('starts with a null tower and a current card', () => {
    const e = new NumberTowersEngine()
    expect(e.tower.every(s => s === null)).toBe(true)
    expect(e.current).toBeGreaterThanOrEqual(1)
    expect(e.current).toBeLessThanOrEqual(99)
  })

  it('places a card in an empty slot', () => {
    const e = new NumberTowersEngine()
    e.current = 50
    const r = e.place(2)
    expect(r.valid).toBe(true)
    expect(r.tower[2]).toBe(50)
  })

  it('rejects duplicate slot', () => {
    const e = new NumberTowersEngine()
    e.current = 50
    e.place(0)
    e.current = 60
    const r = e.place(0)
    expect(r.valid).toBe(false)
  })

  it('rejects out-of-bounds slot', () => {
    const e = new NumberTowersEngine()
    expect(e.place(-1).valid).toBe(false)
    expect(e.place(5).valid).toBe(false)
  })

  it('rejects placement violating ascending order', () => {
    const e = new NumberTowersEngine()
    e.current = 50; e.place(1)
    e.current = 30
    const r = e.place(2)
    expect(r.valid).toBe(false)
  })

  it('wins when all 5 slots filled in ascending order', () => {
    const e = new NumberTowersEngine()
    const vals = [10, 20, 30, 40, 50]
    for (let i = 0; i < 5; i++) { e.current = vals[i]; e.place(i) }
    expect(e.over).toBe(true)
    expect(e.won).toBe(true)
    expect(e.score).toBeGreaterThan(0)
  })

  it('loses when ascending order is broken on game end', () => {
    const e = new NumberTowersEngine()
    e.tower = [10, 5, 30, 40, null]
    e.placed = 4
    e.current = 45
    const r = e.place(4)
    expect(r.won).toBe(false)
  })

  it('can discard a card', () => {
    const e = new NumberTowersEngine()
    const before = e.current
    const r = e.discard()
    expect(r.valid).toBe(true)
    expect(r.discarded).toBe(before)
  })

  it('rejects discards after limit', () => {
    const e = new NumberTowersEngine()
    e._totalDrawn = 9
    expect(e.discard().valid).toBe(false)
  })

  it('getState reflects current tower state', () => {
    const e = new NumberTowersEngine()
    const s = e.getState()
    expect(s.tower).toHaveLength(5)
    expect(s.placed).toBe(0)
  })
})
