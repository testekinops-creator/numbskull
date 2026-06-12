import { describe, it, expect } from 'vitest'
import { ROLES, ROLE_POINTS, assignRoles, scoreRound, pickModifier, MODIFIERS } from './rmcs.js'

const IDS = ['p1', 'p2', 'p3', 'p4']

describe('RMCS assignRoles', () => {
  it('assigns exactly one of each role across the 4 players', () => {
    const roles = assignRoles(IDS)
    expect(Object.keys(roles).sort()).toEqual([...IDS].sort())
    expect(Object.values(roles).sort()).toEqual([...ROLES].sort())
  })

  it('rejects anything other than exactly 4 players', () => {
    expect(() => assignRoles(['a', 'b', 'c'])).toThrow()
    expect(() => assignRoles(['a', 'b', 'c', 'd', 'e'])).toThrow()
    expect(() => assignRoles(null)).toThrow()
  })

  it('shuffles fairly — every player sees every role over many deals', () => {
    const seen = { p1: new Set(), p2: new Set(), p3: new Set(), p4: new Set() }
    for (let i = 0; i < 500; i++) {
      const roles = assignRoles(IDS)
      for (const id of IDS) seen[id].add(roles[id])
    }
    for (const id of IDS) expect(seen[id].size).toBe(4)
  })
})

describe('RMCS scoreRound', () => {
  it('correct guess: Raja 1000 / Mantri 800 / Sipahi 500 / Chor 0', () => {
    expect(scoreRound(true)).toEqual({ RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 })
  })

  it('wrong guess: Chor escapes with the Mantri 800; Sipahi keeps 500', () => {
    expect(scoreRound(false)).toEqual({ RAJA: 1000, MANTRI: 0, SIPAHI: 500, CHOR: 800 })
  })

  it('chit base points match the classic values', () => {
    expect(ROLE_POINTS).toEqual({ RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 })
  })

  it('NONE / SILENT modifiers leave scoring at the base', () => {
    expect(scoreRound(true, 'NONE')).toEqual({ RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 })
    expect(scoreRound(false, 'SILENT')).toEqual({ RAJA: 1000, MANTRI: 0, SIPAHI: 500, CHOR: 800 })
  })

  it('JACKPOT doubles every payout', () => {
    expect(scoreRound(true, 'JACKPOT')).toEqual({ RAJA: 2000, MANTRI: 1600, SIPAHI: 1000, CHOR: 0 })
    expect(scoreRound(false, 'JACKPOT')).toEqual({ RAJA: 2000, MANTRI: 0, SIPAHI: 1000, CHOR: 1600 })
  })

  it('SUDDEN_DEATH triples every payout', () => {
    expect(scoreRound(true, 'SUDDEN_DEATH')).toEqual({ RAJA: 3000, MANTRI: 2400, SIPAHI: 1500, CHOR: 0 })
  })

  it('DOUBLE_STEAL: an escaping Chor robs the Raja too (1800); a catch is normal', () => {
    expect(scoreRound(false, 'DOUBLE_STEAL')).toEqual({ RAJA: 0, MANTRI: 0, SIPAHI: 500, CHOR: 1800 })
    expect(scoreRound(true, 'DOUBLE_STEAL')).toEqual({ RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 })
  })
})

describe('RMCS pickModifier', () => {
  it('round 1 is always NONE; later rounds only ever return known modifiers', () => {
    for (let i = 0; i < 50; i++) expect(pickModifier(1)).toBe('NONE')
    const seen = new Set()
    for (let i = 0; i < 1000; i++) seen.add(pickModifier(5))
    for (const m of seen) expect(MODIFIERS).toContain(m)
    expect(seen.has('NONE')).toBe(true)   // normal rounds still happen
  })
})
