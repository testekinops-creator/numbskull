import { describe, it, expect } from 'vitest'
import { COSMETICS, getCosmetic, listShop, DEFAULT_FRAME } from './cosmetics.js'

describe('cosmetics catalog', () => {
  it('every item is well-formed and ids are unique', () => {
    const ids = new Set()
    for (const c of COSMETICS) {
      expect(['frame', 'title']).toContain(c.type)
      expect(typeof c.id).toBe('string')
      expect(typeof c.value).toBe('string')
      expect(typeof c.cost).toBe('number')
      expect(c.cost).toBeGreaterThanOrEqual(0)
      expect(c.minLevel).toBeGreaterThanOrEqual(1)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
    }
  })

  it('getCosmetic finds by id and returns null for unknown', () => {
    expect(getCosmetic('frame_gold')?.value).toBe('gold')
    expect(getCosmetic('nope')).toBeNull()
  })

  it('listShop returns the full catalog', () => {
    expect(listShop()).toHaveLength(COSMETICS.length)
  })

  it('exposes a default frame', () => {
    expect(DEFAULT_FRAME).toBe('cyan')
  })
})
