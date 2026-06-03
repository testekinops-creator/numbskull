const bluffMap = new Map()

export function initBluff(gameId, playerId) {
  const key = `${gameId}:${playerId}`
  if (!bluffMap.has(key)) bluffMap.set(key, { used: false })
}

export function canBluff(gameId, playerId) {
  const key = `${gameId}:${playerId}`
  return bluffMap.get(key)?.used === false
}

export function useBluff(gameId, playerId, { bulls, cows }) {
  const key = `${gameId}:${playerId}`
  const state = bluffMap.get(key)
  if (!state || state.used) return null

  state.used = true

  const fakeBulls = Math.max(0, Math.min(4, bulls + (Math.random() < 0.5 ? 1 : -1)))
  const fakeCows  = Math.max(0, Math.min(4 - fakeBulls, cows + (Math.random() < 0.5 ? 1 : -1)))

  return { bulls: fakeBulls, cows: fakeCows, wasBluffed: true }
}

export function clearBluff(gameId) {
  for (const key of bluffMap.keys()) {
    if (key.startsWith(`${gameId}:`)) bluffMap.delete(key)
  }
}
