import { describe, it, expect } from 'vitest'
import { ROLES, ROLE_POINTS, assignRoles, scoreRound } from './rmcs.js'

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
})
