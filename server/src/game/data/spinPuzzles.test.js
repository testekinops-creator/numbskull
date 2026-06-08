import { describe, it, expect } from 'vitest'
import { SPIN_PUZZLES, SPIN_CATEGORIES } from './spinPuzzles.js'
import { pickPuzzle, _resetPuzzleRecency } from '../engines/SpinBattleEngine.js'

const lettersOnly = (t) => t.replace(/[^A-Z]/g, '')
const bucketOf = (t) => {
  const n = lettersOnly(t).length
  return n <= 11 ? 'easy' : n >= 18 ? 'hard' : 'medium'
}

describe('Spin Battle puzzle bank', () => {
  it('every puzzle is valid: A–Z + single spaces, sensible length, has a consonant', () => {
    for (const { text } of SPIN_PUZZLES) {
      expect(text, `"${text}" charset`).toMatch(/^[A-Z]+( [A-Z]+)*$/)   // no punctuation / double / edge spaces
      const n = lettersOnly(text).length
      expect(n, `"${text}" length`).toBeGreaterThanOrEqual(3)
      expect(n, `"${text}" length`).toBeLessThanOrEqual(30)
      expect(/[BCDFGHJKLMNPQRSTVWXYZ]/.test(text), `"${text}" has a consonant`).toBe(true)
    }
  })

  it('has no duplicate answers', () => {
    const seen = new Set()
    const dupes = []
    for (const { text } of SPIN_PUZZLES) {
      if (seen.has(text)) dupes.push(text)
      seen.add(text)
    }
    expect(dupes).toEqual([])
  })

  it('every puzzle has a known category', () => {
    for (const { category } of SPIN_PUZZLES) {
      expect(SPIN_CATEGORIES).toContain(category)
    }
  })

  it('every category is represented in the bank', () => {
    const used = new Set(SPIN_PUZZLES.map(p => p.category))
    for (const c of SPIN_CATEGORIES) expect(used.has(c)).toBe(true)
  })

  it('each difficulty bucket stays well-populated (> recency window)', () => {
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const { text } of SPIN_PUZZLES) counts[bucketOf(text)]++
    // Recency window is 12 → each pool must exceed it so a fresh pick always exists.
    expect(counts.easy).toBeGreaterThan(14)
    expect(counts.medium).toBeGreaterThan(14)
    expect(counts.hard).toBeGreaterThan(14)
  })
})

describe('pickPuzzle', () => {
  it('respects the requested difficulty length window', () => {
    _resetPuzzleRecency()
    for (const [diff, lo, hi] of [['easy', 1, 11], ['medium', 12, 17], ['hard', 18, 99]]) {
      for (let i = 0; i < 20; i++) {
        const n = lettersOnly(pickPuzzle(diff).text).length
        expect(n, diff).toBeGreaterThanOrEqual(lo)
        expect(n, diff).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('does not repeat within the recency window', () => {
    _resetPuzzleRecency()
    const seen = []
    for (let i = 0; i < 12; i++) seen.push(pickPuzzle('medium').text)
    expect(new Set(seen).size).toBe(12)   // 12 consecutive picks are all distinct
  })
})
