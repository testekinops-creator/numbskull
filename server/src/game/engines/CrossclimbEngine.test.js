import { describe, it, expect } from 'vitest'
import { CrossclimbEngine, isLadder, ladderLinks, differByOne, isChordless } from './CrossclimbEngine.js'

describe('Crossclimb helpers', () => {
  it('differByOne detects exactly-one-letter changes', () => {
    expect(differByOne('CARD', 'CART')).toBe(true)
    expect(differByOne('CARD', 'CARD')).toBe(false)   // zero changes
    expect(differByOne('CARD', 'CORE')).toBe(false)   // two changes
    expect(differByOne('CARD', 'CARDS')).toBe(false)  // different length
  })

  it('isLadder requires every adjacent pair to differ by one letter', () => {
    expect(isLadder(['COLD', 'CORD', 'CARD', 'CART', 'CARE', 'BARE'])).toBe(true)
    expect(isLadder(['COLD', 'CARD', 'CORD', 'CART', 'CARE', 'BARE'])).toBe(false)
    expect(isLadder(['COLD'])).toBe(false)            // need ≥2
  })

  it('ladderLinks counts valid adjacent links', () => {
    expect(ladderLinks(['COLD', 'CORD', 'CARD'])).toBe(2)
    expect(ladderLinks(['COLD', 'CARE', 'CARD'])).toBe(1)   // only CARE→CARD differs by one
  })
})

describe('CrossclimbEngine generation', () => {
  it('produces a valid, unique (chordless) ladder across difficulties & seeds', () => {
    // Deterministic seeded RNG so a failure is reproducible.
    const mk = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 }
    let ok = 0
    const TRIES = 60
    for (let i = 0; i < TRIES; i++) {
      for (const difficulty of ['easy', 'medium', 'hard']) {
        const e = new CrossclimbEngine({ difficulty, rng: mk(i * 7 + 1) })
        const expectedLen = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 7 : 6
        // The hidden solution is a real ladder AND chordless (⇒ unique answer).
        expect(isLadder(e.solution)).toBe(true)
        expect(isChordless(e.solution)).toBe(true)
        expect(e.solution.length).toBe(expectedLen)
        expect(e.len).toBe(expectedLen)
        // The scrambled rungs are exactly the solution's words, reordered.
        expect([...e.words].sort()).toEqual([...e.solution].sort())
        if (i < 3) ok++
      }
    }
    expect(ok).toBeGreaterThan(0)
  })

  it('does not hand out the solved (or simply reversed) order', () => {
    const e = new CrossclimbEngine({ difficulty: 'medium' })
    const fwd = e.solution.join(',')
    const rev = [...e.solution].reverse().join(',')
    // With ≥5 distinct words a random scramble equal to either is astronomically rare;
    // the constructor also explicitly reshuffles to avoid both.
    expect(e.words.join(',')).not.toBe(fwd)
    expect(e.words.join(',')).not.toBe(rev)
  })

  it('check() validates a permutation and detects the solved ladder', () => {
    const e = new CrossclimbEngine({ difficulty: 'medium' })
    expect(e.check(e.solution)).toMatchObject({ valid: true, solved: true })
    expect(e.check(e.words).valid).toBe(true)                 // scramble is a valid permutation
    expect(e.check(['ZZZZ', ...e.words.slice(1)]).valid).toBe(false)  // not the right word set
    expect(e.check(e.words.slice(0, 3)).valid).toBe(false)    // wrong length
  })

  it('publicPuzzle hides the solution', () => {
    const e = new CrossclimbEngine({ difficulty: 'easy' })
    const pub = e.publicPuzzle()
    expect(pub).toHaveProperty('words')
    expect(pub).toHaveProperty('len')
    expect(pub).not.toHaveProperty('solution')
    expect(pub.words.length).toBe(pub.len)
  })
})
