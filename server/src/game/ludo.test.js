import { describe, it, expect } from 'vitest'
import {
  colorsFor, initTokens, absCell, legalMoves, applyMove, isWin, progress, blockedCells,
  START_OFFSET, SAFE_CELLS, HOME,
} from './ludo.js'

describe('Ludo — setup', () => {
  it('assigns fair colours per player count', () => {
    expect(colorsFor(2)).toEqual(['red', 'yellow'])       // opposite corners
    expect(colorsFor(3)).toEqual(['red', 'green', 'yellow'])
    expect(colorsFor(4)).toEqual(['red', 'green', 'yellow', 'blue'])
  })
  it('starts every token in base', () => {
    const t = initTokens(colorsFor(4))
    for (const c of Object.keys(t)) expect(t[c]).toEqual([-1, -1, -1, -1])
  })
})

describe('Ludo — path mapping', () => {
  it('maps relative pos to the right absolute loop cell', () => {
    expect(absCell('red', 0)).toBe(0)
    expect(absCell('green', 0)).toBe(13)
    expect(absCell('yellow', 0)).toBe(26)
    expect(absCell('blue', 0)).toBe(39)
    expect(absCell('blue', 13)).toBe((39 + 13) % 52)     // wraps the loop
    expect(absCell('red', 51)).toBe(null)                // home column = off the loop
    expect(absCell('red', -1)).toBe(null)                // base
  })
})

describe('Ludo — legal moves', () => {
  it('only a 6 releases a token from base', () => {
    const t = initTokens(['red', 'yellow'])
    expect(legalMoves(t, 'red', 3)).toEqual([])
    expect(legalMoves(t, 'red', 6)).toEqual([0, 1, 2, 3])
  })
  it('needs an exact roll to finish (no overshoot)', () => {
    const t = initTokens(['red', 'yellow'])
    t.red[0] = 54                       // 2 short of HOME(56)
    expect(legalMoves(t, 'red', 2)).toContain(0)   // exact lands home
    expect(legalMoves(t, 'red', 3)).not.toContain(0) // overshoot illegal
    t.red[1] = HOME
    expect(legalMoves(t, 'red', 1)).not.toContain(1) // already home, immovable
  })
})

describe('Ludo — moves & captures', () => {
  it('releases from base onto the start cell with a 6', () => {
    const t = initTokens(['red', 'yellow'])
    const r = applyMove(t, 'red', 0, 6)
    expect(t.red[0]).toBe(0)
    expect(r.finished).toBe(false)
  })
  it('captures a lone opponent on a non-safe cell', () => {
    const t = initTokens(['red', 'yellow'])
    // yellow token sitting on absolute cell 5 (yellow rel pos = 5-26 mod 52 = 31)
    t.yellow[0] = 31
    expect(absCell('yellow', 31)).toBe(5)
    t.red[0] = 4                         // red one short of cell 5
    const r = applyMove(t, 'red', 0, 1)  // red lands on abs cell 5
    expect(absCell('red', 5)).toBe(5)
    expect(t.yellow[0]).toBe(-1)         // sent home
    expect(r.captured).toEqual([{ color: 'yellow', i: 0 }])
  })
  it('does NOT capture on a safe cell', () => {
    const t = initTokens(['red', 'yellow'])
    expect(SAFE_CELLS.has(8)).toBe(true)
    t.yellow[0] = (8 - 26 + 52) % 52     // yellow rel pos for abs cell 8
    expect(absCell('yellow', t.yellow[0])).toBe(8)
    t.red[0] = 7
    const r = applyMove(t, 'red', 0, 1)  // red lands on safe abs cell 8
    expect(t.yellow[0]).not.toBe(-1)     // untouched
    expect(r.captured).toEqual([])
  })
  it('flags finishing and detects a win', () => {
    const t = initTokens(['red', 'yellow'])
    t.red = [HOME, HOME, HOME, 54]
    expect(isWin(t, 'red')).toBe(false)
    const r = applyMove(t, 'red', 3, 2)  // exact to HOME
    expect(r.finished).toBe(true)
    expect(isWin(t, 'red')).toBe(true)
  })
  it('progress increases as tokens advance', () => {
    const t = initTokens(['red', 'yellow'])
    expect(progress(t, 'red')).toBe(0)
    t.red = [0, -1, -1, -1]
    expect(progress(t, 'red')).toBe(1)
    t.red = [HOME, HOME, HOME, HOME]
    expect(progress(t, 'red')).toBe((HOME + 1) * 4)
  })
})

describe('Ludo — blocks / barricades', () => {
  it('detects an opponent block (2+ of one colour on a loop cell)', () => {
    const t = initTokens(['red', 'yellow'])
    t.yellow[0] = 31; t.yellow[1] = 31           // two yellow on abs cell 5
    expect(absCell('yellow', 31)).toBe(5)
    expect(blockedCells(t, 'red').has(5)).toBe(true)
    expect(blockedCells(t, 'yellow').has(5)).toBe(false)  // your own pair never blocks you
  })
  it('cannot pass over OR land on an opponent block', () => {
    const t = initTokens(['red', 'yellow'])
    t.yellow[0] = 31; t.yellow[1] = 31           // block on abs cell 5
    t.red[0] = 3                                  // red 2 short of the block
    expect(legalMoves(t, 'red', 2)).not.toContain(0)  // landing on the block — illegal
    expect(legalMoves(t, 'red', 3)).not.toContain(0)  // passing over the block — illegal
    expect(legalMoves(t, 'red', 1)).toContain(0)      // stops before it — fine
  })
  it('a single opponent is not a block (still capturable)', () => {
    const t = initTokens(['red', 'yellow'])
    t.yellow[0] = 31                              // one yellow on abs cell 5
    t.red[0] = 4
    expect(legalMoves(t, 'red', 1)).toContain(0)  // may land
    const r = applyMove(t, 'red', 0, 1)
    expect(t.yellow[0]).toBe(-1)                  // captured
    expect(r.captured).toEqual([{ color: 'yellow', i: 0 }])
  })
  it('cannot release onto a blocked start cell', () => {
    const t = initTokens(['red', 'yellow'])
    // green/blue not in play; put two yellow on red's start (abs 0)
    t.yellow[0] = (0 - 26 + 52) % 52; t.yellow[1] = (0 - 26 + 52) % 52
    expect(absCell('yellow', t.yellow[0])).toBe(0)
    expect(legalMoves(t, 'red', 6)).toEqual([])   // can't come out onto the block
  })
})
