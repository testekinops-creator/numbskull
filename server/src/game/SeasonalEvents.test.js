import { describe, it, expect } from 'vitest'
import { getActiveEvent, applyEventModifier, getAllEvents } from './SeasonalEvents.js'

describe('SeasonalEvents', () => {
  it('returns all 4 events', () => {
    expect(getAllEvents()).toHaveLength(4)
  })

  it('returns October event in October', () => {
    const oct = new Date(2026, 9, 15)
    const event = getActiveEvent(oct)
    expect(event?.id).toBe('spooky_october')
  })

  it('returns December event in December', () => {
    const dec = new Date(2026, 11, 20)
    expect(getActiveEvent(dec)?.id).toBe('holiday_december')
  })

  it('returns null for off-season months', () => {
    const mar = new Date(2026, 2, 10)
    expect(getActiveEvent(mar)).toBeNull()
  })

  it('returns summer event in June and July', () => {
    const june = new Date(2026, 5, 1)
    const july = new Date(2026, 6, 15)
    expect(getActiveEvent(june)?.id).toBe('summer_june')
    expect(getActiveEvent(july)?.id).toBe('summer_june')
  })

  it('applyEventModifier adds range bonus', () => {
    const oct = new Date(2026, 9, 1)
    const event = getActiveEvent(oct)
    const cfg = applyEventModifier({ range: 100 }, event)
    expect(cfg.range).toBe(200)
  })

  it('applyEventModifier is a no-op with null event', () => {
    const cfg = applyEventModifier({ range: 100 }, null)
    expect(cfg.range).toBe(100)
  })

  it('applyEventModifier adds xpMultiplier for summer', () => {
    const june = new Date(2026, 5, 1)
    const event = getActiveEvent(june)
    const cfg = applyEventModifier({}, event)
    expect(cfg.xpMultiplier).toBe(2)
  })
})
