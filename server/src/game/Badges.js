export const BADGES = [
  { slug: 'first_win',       name: 'First Blood',        icon: '🩸', description: 'Win your first game.' },
  { slug: 'hot_streak_3',    name: 'On Fire',             icon: '🔥', description: 'Win 3 games in a row.' },
  { slug: 'hot_streak_5',    name: 'Inferno',             icon: '🌋', description: 'Win 5 games in a row.' },
  { slug: 'optimal_gtn',     name: 'Binary Brain',        icon: '🧠', description: 'Solve GTN in the optimal number of guesses.' },
  { slug: 'bc_unlock',       name: 'Code Curious',        icon: '🔑', description: 'Unlock Bulls & Cows.' },
  { slug: 'bc_first_win',    name: 'Code Breaker',        icon: '🐂', description: 'Win your first Bulls & Cows game.' },
  { slug: 'daily_1',         name: 'Daily Player',        icon: '📅', description: 'Complete a daily challenge.' },
  { slug: 'daily_7',         name: 'Weekly Warrior',      icon: '🗓️', description: 'Complete 7 daily challenges.' },
  { slug: 'daily_30',        name: 'Monthly Legend',      icon: '🏆', description: 'Complete 30 daily challenges.' },
  { slug: 'ghost_beat',      name: 'Ghost Buster',        icon: '👻', description: 'Beat your own ghost.' },
  { slug: 'rivalry',         name: 'Rival',               icon: '😤', description: 'Reach Rivalry personality tier (100 games).' },
  { slug: 'speed_10s',       name: 'Speed Demon',         icon: '⚡', description: 'Win a GTN game in under 10 seconds.' },
  { slug: 'multi_first_win', name: 'Gladiator',           icon: '⚔️', description: 'Win your first multiplayer game.' },
  { slug: 'bluff_success',   name: 'Liar Liar',           icon: '🃏', description: 'Successfully bluff an opponent in B&C.' },
  { slug: 'gtn_range_1000',  name: 'Needle in a Stack',   icon: '🪡', description: 'Solve GTN in the 1–1000 range.' },
  { slug: 'quest_complete',  name: 'Quest Hero',          icon: '⭐', description: 'Complete a weekly quest.' },
  { slug: 'play_100',        name: 'Century Club',        icon: '💯', description: 'Play 100 games.' },
]

const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.slug, b]))

export function getBadge(slug) {
  return BADGE_MAP[slug] || null
}

export function checkBadges(stats) {
  const earned = []

  if (stats.totalGames === 1 && stats.lastWon) earned.push('first_win')
  if (stats.totalGames >= 100) earned.push('play_100')
  if (stats.winStreak >= 3) earned.push('hot_streak_3')
  if (stats.winStreak >= 5) earned.push('hot_streak_5')
  if (stats.lastWon && stats.lastMode === 'GTN' && stats.lastOptimal) earned.push('optimal_gtn')
  if (stats.gtnWins >= 3 && !stats.hadBcUnlock) earned.push('bc_unlock')
  if (stats.bcWins === 1) earned.push('bc_first_win')
  if (stats.dailyChallenges === 1) earned.push('daily_1')
  if (stats.dailyChallenges >= 7) earned.push('daily_7')
  if (stats.dailyChallenges >= 30) earned.push('daily_30')
  if (stats.ghostBeaten) earned.push('ghost_beat')
  if (stats.totalGames >= 100) earned.push('rivalry')
  if (stats.lastWon && stats.lastMode === 'GTN' && stats.lastTimeMs < 10_000) earned.push('speed_10s')
  if (stats.multiWins === 1) earned.push('multi_first_win')
  if (stats.bluffSuccess) earned.push('bluff_success')
  if (stats.gtnRange1000Win) earned.push('gtn_range_1000')
  if (stats.questsCompleted >= 1) earned.push('quest_complete')

  return [...new Set(earned)].filter(s => !stats.alreadyEarned?.includes(s))
}
