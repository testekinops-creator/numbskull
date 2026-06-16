// Client mirror of the server level curve (server/src/game/progression.js) so the
// profile XP bar matches exactly. Cumulative XP to reach level n = 50·n·(n−1).
export function xpForLevel(n) {
  const lvl = Math.max(1, Math.floor(n))
  return 50 * lvl * (lvl - 1)
}

export function levelForXp(xp = 0) {
  const x = Math.max(0, Number(xp) || 0)
  return Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * x)) / 100))
}

export function levelProgress(xp = 0) {
  const x = Math.max(0, Number(xp) || 0)
  const level = levelForXp(x)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const into = x - base
  const span = next - base
  return { level, into, span, pct: span > 0 ? Math.round((into / span) * 100) : 0, nextLevelXp: next }
}
