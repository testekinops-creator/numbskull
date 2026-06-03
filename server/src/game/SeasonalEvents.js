const EVENTS = [
  {
    id:       'spooky_october',
    name:     '🎃 Spooky Numbers',
    months:   [10],
    modifier: { rangeBonus: 100, skullExpression: 'evil', roastPrefix: 'MORTIFYING. ' },
    badge:    'spooky_player',
  },
  {
    id:       'holiday_december',
    name:     '❄️ Frosty Challenge',
    months:   [12],
    modifier: { timeBonusMs: 10_000, skullExpression: 'grudging', roastPrefix: 'Even elves do better. ' },
    badge:    'winter_player',
  },
  {
    id:       'summer_june',
    name:     '☀️ Summer Blitz',
    months:   [6, 7],
    modifier: { xpMultiplier: 2, skullExpression: 'annoyed', roastPrefix: 'Sweating already? ' },
    badge:    'summer_player',
  },
  {
    id:       'new_year',
    name:     '🎆 New Year Rush',
    months:   [1],
    modifier: { maxGuessBonus: 2, roastPrefix: 'New year, same mediocrity. ' },
    badge:    'new_year_player',
  },
]

export function getActiveEvent(date = new Date()) {
  const month = date.getMonth() + 1
  return EVENTS.find(e => e.months.includes(month)) || null
}

export function getAllEvents() { return EVENTS }

export function applyEventModifier(baseConfig, event) {
  if (!event) return baseConfig
  const m = event.modifier
  return {
    ...baseConfig,
    range:       (baseConfig.range || 100) + (m.rangeBonus || 0),
    timeLimitMs: (baseConfig.timeLimitMs || 60_000) + (m.timeBonusMs || 0),
    xpMultiplier: m.xpMultiplier || 1,
    skullExpression: m.skullExpression,
    roastPrefix: m.roastPrefix || '',
  }
}
