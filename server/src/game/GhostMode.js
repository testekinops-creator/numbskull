const GHOST_TTL_MS = 24 * 60 * 60 * 1000

const store = new Map()

export function saveGhostRun({ playerId, mode, guesses, timeMs, won, secret }) {
  if (!won) return
  const key = `${playerId}:${mode}`
  const existing = store.get(key)
  if (existing && existing.guesses.length <= guesses.length && existing.timeMs <= timeMs) return
  store.set(key, { playerId, mode, guesses: [...guesses], timeMs, secret, savedAt: Date.now() })
}

export function getGhostRun(playerId, mode) {
  const key = `${playerId}:${mode}`
  const run = store.get(key)
  if (!run) return null
  if (Date.now() - run.savedAt > GHOST_TTL_MS) { store.delete(key); return null }
  return {
    mode: run.mode,
    guesses: run.guesses,
    timeMs: run.timeMs,
    totalGuesses: run.guesses.length,
  }
}

export function compareToGhost(playerId, mode, newGuesses, newTimeMs) {
  const ghost = getGhostRun(playerId, mode)
  if (!ghost) return { hasGhost: false }
  const beat = newGuesses.length < ghost.totalGuesses ||
    (newGuesses.length === ghost.totalGuesses && newTimeMs < ghost.timeMs)
  return {
    hasGhost: true,
    beat,
    ghost: { totalGuesses: ghost.totalGuesses, timeMs: ghost.timeMs },
    you:   { totalGuesses: newGuesses.length,  timeMs: newTimeMs },
  }
}
