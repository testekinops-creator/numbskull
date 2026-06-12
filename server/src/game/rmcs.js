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

// ── Twist rounds (modifiers) ────────────────────────────────────────────────
// Each round may carry a modifier that changes the stakes — keeps a long session
// fresh. Announced at the start of the round so players feel the pressure.
export const MODIFIERS = ['NONE', 'JACKPOT', 'DOUBLE_STEAL', 'SUDDEN_DEATH', 'SILENT']
export const MODIFIER_META = {
  NONE:         { label: null, emoji: null, desc: null },
  JACKPOT:      { label: 'Jackpot',      emoji: '💰', desc: 'Points are DOUBLED this round.' },
  DOUBLE_STEAL: { label: 'Double Steal', emoji: '🥷', desc: 'If the Chor escapes, they rob the Raja AND the Mantri.' },
  SUDDEN_DEATH: { label: 'Sudden Death', emoji: '⚡', desc: 'TRIPLE points — a massive swing.' },
  SILENT:       { label: 'Silent Round', emoji: '🤫', desc: 'No table talk — read them with your eyes.' },
}

// Pick a modifier for an upcoming round. Round 1 is always normal (let players
// learn the base game); after that, roughly half the rounds get a twist.
export function pickModifier(round) {
  if (round <= 1) return 'NONE'
  if (Math.random() < 0.5) return 'NONE'
  const twists = ['JACKPOT', 'DOUBLE_STEAL', 'SUDDEN_DEATH', 'SILENT']
  return twists[Math.floor(Math.random() * twists.length)]
}

// Round scoring (traditional steal variant, per user decision):
//   correct guess → Raja 1000, Mantri 800, Sipahi 500, Chor 0
//   wrong guess   → Raja 1000, Mantri 0, Sipahi 500, Chor ESCAPES WITH 800
// Modifiers: JACKPOT ×2, SUDDEN_DEATH ×3, DOUBLE_STEAL (escaping Chor also robs
// the Raja → Raja 0, Chor 1800). SILENT/NONE leave scoring at the base.
export function scoreRound(correct, modifier = 'NONE') {
  let pts = correct
    ? { RAJA: 1000, MANTRI: 800, SIPAHI: 500, CHOR: 0 }
    : { RAJA: 1000, MANTRI: 0,   SIPAHI: 500, CHOR: 800 }

  if (modifier === 'DOUBLE_STEAL' && !correct) {
    pts = { RAJA: 0, MANTRI: 0, SIPAHI: 500, CHOR: 1800 }
  }

  const mult = modifier === 'JACKPOT' ? 2 : modifier === 'SUDDEN_DEATH' ? 3 : 1
  if (mult !== 1) {
    pts = Object.fromEntries(Object.entries(pts).map(([role, v]) => [role, v * mult]))
  }
  return pts
}
