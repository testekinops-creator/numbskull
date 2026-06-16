import { describe, it, expect } from 'vitest'
import {
  xpForLevel, levelForXp, levelProgress, awardForGame,
  XP_PLAY, XP_WIN, XP_MULTI_WIN_BONUS, COINS_WIN, COINS_LOSS, COINS_MULTI_WIN_BONUS,
} from './progression.js'

describe('level curve', () => {
  it('xpForLevel matches the 50·n·(n−1) curve', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(300)
    expect(xpForLevel(5)).toBe(1000)
  })

  it('levelForXp inverts the curve at and around thresholds', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(299)).toBe(2)
    expect(levelForXp(300)).toBe(3)
    expect(levelForXp(1000)).toBe(5)
  })

  it('is monotonic — more xp never lowers the level', () => {
    let last = 1
    for (let xp = 0; xp <= 5000; xp += 37) {
      const l = levelForXp(xp)
      expect(l).toBeGreaterThanOrEqual(last)
      last = l
    }
  })

  it('levelProgress reports a sane in-level position', () => {
    const p = levelProgress(150)               // level 2 (100..300)
    expect(p.level).toBe(2)
    expect(p.into).toBe(50)
    expect(p.span).toBe(200)
    expect(p.pct).toBe(25)
    expect(p.nextLevelXp).toBe(300)
  })

  it('handles 0 / garbage xp safely', () => {
    expect(levelForXp(undefined)).toBe(1)
    expect(levelForXp(-50)).toBe(1)
    expect(levelProgress(0).level).toBe(1)
  })
})

describe('awardForGame', () => {
  it('awards play XP + small coins on a loss', () => {
    expect(awardForGame({ won: false })).toEqual({ xp: XP_PLAY, coins: COINS_LOSS })
  })
  it('awards win XP + coins on a solo win', () => {
    expect(awardForGame({ won: true })).toEqual({ xp: XP_WIN, coins: COINS_WIN })
  })
  it('adds the multiplayer bonus on a multiplayer win', () => {
    expect(awardForGame({ won: true, multiplayer: true })).toEqual({
      xp: XP_WIN + XP_MULTI_WIN_BONUS,
      coins: COINS_WIN + COINS_MULTI_WIN_BONUS,
    })
  })
  it('no multiplayer bonus on a multiplayer loss', () => {
    expect(awardForGame({ won: false, multiplayer: true })).toEqual({ xp: XP_PLAY, coins: COINS_LOSS })
  })
})
