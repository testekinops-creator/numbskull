// Player progression: XP → levels, and the XP/coins awarded per game. Pure (no
// I/O) so it's trivially testable and usable from routes. Level is DERIVED from
// lifetime xp (no stored level field) via a gentle quadratic curve.
//
// Cumulative XP needed to REACH level n:  xpForLevel(n) = 50·n·(n−1)
//   L1=0  L2=100  L3=300  L4=600  L5=1000  L6=1500 …  (each level costs +100 more)

export const XP_PLAY              = 10   // every finished game
export const XP_WIN               = 25   // a win (replaces XP_PLAY, not added)
export const XP_MULTI_WIN_BONUS   = 10   // extra for beating a real opponent
export const COINS_WIN            = 10
export const COINS_LOSS           = 2
export const COINS_MULTI_WIN_BONUS = 5
export const COINS_PER_LEVEL      = 50   // bonus coins granted on each level-up

export function xpForLevel(n) {
  const lvl = Math.max(1, Math.floor(n))
  return 50 * lvl * (lvl - 1)
}

export function levelForXp(xp = 0) {
  const x = Math.max(0, Number(xp) || 0)
  // Invert 50·n·(n−1) = x  →  n = (50 + √(2500 + 200x)) / 100
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

// What a single finished game awards.
export function awardForGame({ won = false, multiplayer = false } = {}) {
  let xp    = won ? XP_WIN  : XP_PLAY
  let coins = won ? COINS_WIN : COINS_LOSS
  if (won && multiplayer) { xp += XP_MULTI_WIN_BONUS; coins += COINS_MULTI_WIN_BONUS }
  return { xp, coins }
}
