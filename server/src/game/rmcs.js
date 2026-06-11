// Raja Mantri Chor Sipahi (RMCS) — pure helpers for the 4-player hidden-role game.
// All role assignment and scoring is server-side; roles never leave this process
// except each player's own role (injected per-viewer in _matchView).

export const ROLES = ['RAJA', 'MANTRI', 'CHOR', 'SIPAHI']

// Base points shown on the chit when you reveal it.
export const ROLE_POINTS = { RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 }

// Fisher–Yates shuffle → { playerId: role }, exactly one of each role.
export function assignRoles(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length !== 4) {
    throw new Error('RMCS needs exactly 4 players')
  }
  const deck = [...ROLES]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const roles = {}
  playerIds.forEach((id, i) => { roles[id] = deck[i] })
  return roles
}

// Round scoring (traditional steal variant, per user decision):
//   correct guess → Raja 1000, Mantri 800, Sipahi 500, Chor 0
//   wrong guess   → Raja 1000, Mantri 0, Sipahi 500, Chor ESCAPES WITH 800
export function scoreRound(correct) {
  return correct
    ? { RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 }
    : { RAJA: 1000, MANTRI: 0,   SIPAHI: 500, CHOR: 800 }
}
