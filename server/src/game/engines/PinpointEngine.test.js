import { describe, it, expect } from 'vitest'
import { PinpointEngine, CATEGORIES } from './PinpointEngine.js'

describe('PinpointEngine content', () => {
  it('has a healthy pool of distinct categories, each with exactly 5 clues', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(100)
    const names = CATEGORIES.map(c => c.name)
    expect(new Set(names).size).toBe(names.length)        // no duplicate category names
    for (const c of CATEGORIES) {
      expect(c.clues.length).toBe(5)
      expect(new Set(c.clues).size).toBe(5)               // no repeated clue within a category
      c.clues.forEach(clue => expect(typeof clue).toBe('string'))
    }
  })
})

describe('PinpointEngine', () => {
  it('generates the requested number of rounds', () => {
    const e = new PinpointEngine({ count: 5 })
    expect(e.rounds.length).toBe(5)
    expect(e.total).toBe(5)
  })

  it('uses distinct categories within a game', () => {
    const e = new PinpointEngine({ count: 5 })
    const answers = e.rounds.map(r => r.answer)
    expect(new Set(answers).size).toBe(answers.length)
  })

  it('every round has exactly 4 distinct options including the answer', () => {
    const e = new PinpointEngine({ count: 30 })
    for (const r of e.rounds) {
      expect(r.options.length).toBe(4)
      expect(new Set(r.options).size).toBe(4)
      expect(r.options).toContain(r.answer)
      // every option is a real category name
      r.options.forEach(o => expect(CATEGORIES.some(c => c.name === o)).toBe(true))
    }
  })

  it('every round has 5 clues drawn from its answer category', () => {
    const e = new PinpointEngine({ count: 30 })
    for (const r of e.rounds) {
      const cat = CATEGORIES.find(c => c.name === r.answer)
      expect(r.clues.length).toBe(5)
      r.clues.forEach(clue => expect(cat.clues).toContain(clue))
    }
  })

  it('publicRound reveals only the clues seen so far and hides the answer', () => {
    const e = new PinpointEngine({ count: 5 })
    const pub = e.publicRound(0, 2)
    expect(pub.clues.length).toBe(2)
    expect(pub.options.length).toBe(4)
    expect(pub).not.toHaveProperty('answer')
    expect(pub.index).toBe(0)
    expect(pub.revealed).toBe(2)
    expect(pub.total).toBe(5)
  })

  it('publicRound clamps the reveal count to the clue range', () => {
    const e = new PinpointEngine({ count: 3 })
    expect(e.publicRound(0, 99).clues.length).toBe(5)
    expect(e.publicRound(0, 0).clues.length).toBe(0)
  })

  it('check() scores correct and incorrect choices', () => {
    const e = new PinpointEngine({ count: 3 })
    const r = e.rounds[0]
    const wrong = r.options.find(o => o !== r.answer)
    expect(e.check(0, r.answer)).toMatchObject({ valid: true, correct: true, answer: r.answer })
    expect(e.check(0, wrong)).toMatchObject({ valid: true, correct: false })
  })

  it('check() rejects an out-of-range index', () => {
    const e = new PinpointEngine({ count: 2 })
    expect(e.check(99, 'x').valid).toBe(false)
  })

  it('pointsFor rewards fewer clues (5 down to 1)', () => {
    expect(PinpointEngine.pointsFor(1)).toBe(5)
    expect(PinpointEngine.pointsFor(2)).toBe(4)
    expect(PinpointEngine.pointsFor(5)).toBe(1)
    expect(PinpointEngine.pointsFor(8)).toBe(1)   // never below 1
  })

  it('is deterministic given a seeded RNG', () => {
    const seed = () => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff }
    const a = new PinpointEngine({ count: 5, rng: seed() })
    const b = new PinpointEngine({ count: 5, rng: seed() })
    expect(a.rounds.map(r => r.answer)).toEqual(b.rounds.map(r => r.answer))
    expect(a.rounds[0].options).toEqual(b.rounds[0].options)
  })
})
