import { api } from './api.js'

// Client-side badge progress. Tracks the running stats badges depend on
// (streak, win counts) in localStorage, asks the server which badges are newly
// earned after each game, persists them, and fires a window event so the
// BadgeToast can celebrate. Works for guests and registered players alike.
const STATS_KEY  = 'ns_badge_stats'
const EARNED_KEY = 'ns_badges_earned'

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback } catch { return fallback }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

export function getEarnedBadges() { return load(EARNED_KEY, []) }

export async function recordGameForBadges({ mode, won = false, optimal = false, multiplayer = false, gtnRange1000Win = false } = {}) {
  const s = load(STATS_KEY, {})
  s.totalGames = (s.totalGames || 0) + 1
  s.winStreak  = won ? (s.winStreak || 0) + 1 : 0
  if (won && mode === 'GTN') s.gtnWins   = (s.gtnWins   || 0) + 1
  if (won && mode === 'BC')  s.bcWins    = (s.bcWins    || 0) + 1
  if (won && multiplayer)    s.multiWins = (s.multiWins || 0) + 1
  save(STATS_KEY, s)

  const earned = load(EARNED_KEY, [])
  const stats = {
    totalGames: s.totalGames,
    winStreak:  s.winStreak,
    gtnWins:    s.gtnWins || 0,
    bcWins:     s.bcWins || 0,
    multiWins:  s.multiWins || 0,
    lastWon:    won,
    lastMode:   mode,
    lastOptimal: optimal,
    gtnRange1000Win,
    hadBcUnlock: earned.includes('bc_unlock'),
    alreadyEarned: earned,
  }

  try {
    const data = await api.post('/badges/check', stats)
    const newly = (data.earned || []).filter(slug => !earned.includes(slug))
    if (newly.length) {
      save(EARNED_KEY, [...new Set([...earned, ...newly])])
      window.dispatchEvent(new CustomEvent('ns-badge-earned', { detail: { slugs: newly } }))
    }
    return newly
  } catch {
    return []
  }
}
