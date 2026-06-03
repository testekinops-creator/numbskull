import { describe, it, expect } from 'vitest'
import { checkBadges, getBadge, BADGES } from './Badges.js'

describe('Badges', () => {
  it('has 17 badges', () => {
    expect(BADGES).toHaveLength(17)
  })

  it('getBadge returns correct badge', () => {
    const b = getBadge('first_win')
    expect(b.name).toBe('First Blood')
    expect(b.icon).toBe('🩸')
  })

  it('getBadge returns null for unknown slug', () => {
    expect(getBadge('nonexistent')).toBeNull()
  })

  it('awards first_win on first won game', () => {
    const badges = checkBadges({ totalGames: 1, lastWon: true, lastMode: 'GTN', winStreak: 1 })
    expect(badges).toContain('first_win')
  })

  it('awards hot_streak_3 at win streak 3', () => {
    const badges = checkBadges({ totalGames: 5, winStreak: 3, lastWon: true })
    expect(badges).toContain('hot_streak_3')
  })

  it('awards hot_streak_5 at win streak 5', () => {
    const badges = checkBadges({ totalGames: 10, winStreak: 5, lastWon: true })
    expect(badges).toContain('hot_streak_5')
    expect(badges).toContain('hot_streak_3')
  })

  it('awards optimal_gtn for optimal GTN win', () => {
    const badges = checkBadges({ totalGames: 3, lastWon: true, lastMode: 'GTN', lastOptimal: true })
    expect(badges).toContain('optimal_gtn')
  })

  it('does not re-award already earned badges', () => {
    const badges = checkBadges({
      totalGames: 1, lastWon: true, lastMode: 'GTN', winStreak: 1,
      alreadyEarned: ['first_win'],
    })
    expect(badges).not.toContain('first_win')
  })

  it('awards play_100 at 100 games', () => {
    const badges = checkBadges({ totalGames: 100 })
    expect(badges).toContain('play_100')
    expect(badges).toContain('rivalry')
  })

  it('awards bc_unlock when gtnWins reaches 3', () => {
    const badges = checkBadges({ gtnWins: 3, hadBcUnlock: false })
    expect(badges).toContain('bc_unlock')
  })

  it('does not award bc_unlock if already had it', () => {
    const badges = checkBadges({ gtnWins: 3, hadBcUnlock: true })
    expect(badges).not.toContain('bc_unlock')
  })
})
