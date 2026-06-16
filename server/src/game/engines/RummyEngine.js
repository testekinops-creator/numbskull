// Indian 13-card Rummy — pure rules engine (no I/O). The socket layer
// (matchHandlers.js) owns room state, turn flow and broadcasting; this engine
// owns the deck, the deal, and — the hard part — validating a player's declared
// arrangement and scoring deadwood. All state it produces is plain,
// JSON-serialisable data so it can live on `room.match` and survive Redis.
//
// Hands are NEVER sent to other players: the engine just produces them; the
// socket layer keeps them server-side and reveals each hand only to its owner
// (see `_matchView`), exactly like RMCS hidden roles.
//
// Rules implemented (standard Indian 13-card Rummy):
//   • 2 decks (104) + 2 printed jokers = 106 cards, for 2–6 players.
//   • 13 cards dealt each; one card cut as the WILD joker (its rank is wild in
//     any suit); printed jokers are always wild.
//   • A valid declaration partitions the 13 cards into melds (each ≥3 cards)
//     that are runs (consecutive, same suit) or sets (same rank, distinct suits);
//     jokers/wilds substitute missing cards. It MUST contain ≥2 sequences and
//     ≥1 PURE sequence (a run formed with NO joker/wild substitution).

import { randomInt } from 'node:crypto'

export const SUITS = ['S', 'H', 'D', 'C']  // ♠ ♥ ♦ ♣
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const JOKER_SUIT = 'JOKER'

// Deadwood point values. Aces and faces are 10; numbers are face value; jokers 0.
export const RANK_POINTS = {
  A: 10, J: 10, Q: 10, K: 10, '10': 10,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
}
const FULL_COUNT_CAP = 80

// Rank → ordinal for run adjacency (Ace is low here; Ace-high handled separately).
const RANK_ORDER = Object.fromEntries(RANKS.map((r, i) => [r, i + 1]))  // A=1 … K=13

export function isPrintedJoker(card) { return card?.suit === JOKER_SUIT }
export function isWildCard(card, wildRank) {
  return isPrintedJoker(card) || (!!wildRank && card?.rank === wildRank)
}

// ── Deal ─────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Unbiased Fisher–Yates. Cryptographically random in production; seeded
// (deterministic) when a seed is supplied — used by tests.
function shuffle(arr, seed) {
  const a = [...arr]
  const randInt = seed == null
    ? (n) => randomInt(0, n)
    : (() => { const m = mulberry32(seed); return (n) => Math.floor(m() * n) })()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Crypto-shuffle an arbitrary pile (used to recycle the discard pile back into
// the stock when it runs dry mid-deal).
export function shuffleCards(cards) { return shuffle(cards) }

export function buildDeck() {
  const cards = []
  for (let deck = 0; deck < 2; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push(Object.freeze({ id: `${rank}${suit}_${deck}`, rank, suit }))
    }
  }
  cards.push(Object.freeze({ id: 'JK_0', rank: 'JOKER', suit: JOKER_SUIT }))
  cards.push(Object.freeze({ id: 'JK_1', rank: 'JOKER', suit: JOKER_SUIT }))
  return cards
}

export class RummyEngine {
  // playerIds: array (2–6). seed: optional, for deterministic tests.
  constructor({ playerIds = [], seed = null } = {}) {
    const stock = shuffle(buildDeck(), seed)
    this.hands = {}
    for (const id of playerIds) this.hands[id] = []
    // Deal 13 to each player, round-robin.
    for (let n = 0; n < 13; n++) {
      for (const id of playerIds) this.hands[id].push(stock.pop())
    }
    // Cut the wild joker. If it's a printed joker, Ace becomes the wild rank.
    this.wildJoker = stock.pop()
    this.wildRank = isPrintedJoker(this.wildJoker) ? 'A' : this.wildJoker.rank
    // Open the discard pile with one card; the rest is the closed stock.
    this.discard = [stock.pop()]
    this.stock = stock
  }
}

// ── Run / set primitives ───────────────────────────────────────────────────────
// Can `size` consecutive slots cover the given distinct natural ordinals, padded
// with `wildCount` jokers, staying within [1..14]? (14 = Ace-high.)
function runFits(orders, wildCount) {
  const size = orders.length + wildCount
  if (size < 3) return false
  const uniq = new Set(orders)
  if (uniq.size !== orders.length) return false       // a run can't repeat a rank
  if (orders.length === 0) return false               // need ≥1 natural to anchor
  const min = Math.min(...orders), max = Math.max(...orders)
  if (min < 1 || max > 14) return false
  if (max - min > size - 1) return false              // naturals span wider than the window
  // A window [b, b+size-1] within [1,14] that contains [min,max] must exist.
  const lo = Math.max(1, max - size + 1)
  const hi = Math.min(min, 14 - size + 1)
  return lo <= hi
}

// Natural ordinals for same-suit cards, trying Ace low (1) and Ace high (14).
function sameSuitRunOk(naturals, wildCount) {
  if (naturals.length && new Set(naturals.map(c => c.suit)).size > 1) return false
  const hasAce = naturals.some(c => c.rank === 'A')
  const base = naturals.map(c => RANK_ORDER[c.rank])
  if (runFits(base, wildCount)) return true
  if (hasAce) {
    const high = naturals.map(c => (c.rank === 'A' ? 14 : RANK_ORDER[c.rank]))
    if (runFits(high, wildCount)) return true
  }
  return false
}

// Split a group's wild-rank cards (which may act as natural OR wild) into all
// possible (naturalsUsedAsNatural, wildCount) combinations, given the printed
// jokers are always wild.
function* wildAssignments(group, wildRank) {
  const printedWilds = group.filter(isPrintedJoker).length
  const flexible = group.filter(c => !isPrintedJoker(c) && c.rank === wildRank)
  const fixedNaturals = group.filter(c => !isPrintedJoker(c) && c.rank !== wildRank)
  const k = flexible.length
  for (let mask = 0; mask < (1 << k); mask++) {
    const naturals = [...fixedNaturals]
    let wilds = printedWilds
    for (let b = 0; b < k; b++) {
      if (mask & (1 << b)) naturals.push(flexible[b]); else wilds++
    }
    yield { naturals, wilds }
  }
}

// A run formed with NO joker and NO wild substitution (wild-rank cards used at
// their natural value ARE allowed and still count as pure).
export function isPureSequenceGroup(group, wildRank) {
  if (group.length < 3) return false
  if (group.some(isPrintedJoker)) return false
  return sameSuitRunOk(group, 0)
}

export function isSequenceGroup(group, wildRank) {
  if (group.length < 3) return false
  for (const { naturals, wilds } of wildAssignments(group, wildRank)) {
    if (sameSuitRunOk(naturals, wilds)) return true
  }
  return false
}

export function isSetGroup(group, wildRank) {
  const size = group.length
  if (size < 3 || size > 4) return false
  for (const { naturals, wilds } of wildAssignments(group, wildRank)) {
    if (naturals.length === 0) continue
    const ranks = new Set(naturals.map(c => c.rank))
    const suits = new Set(naturals.map(c => c.suit))
    if (ranks.size === 1 && suits.size === naturals.length && naturals.length + wilds <= 4) return true
  }
  return false
}

export function classifyGroup(group, wildRank) {
  const pure = isPureSequenceGroup(group, wildRank)
  const seq = pure || isSequenceGroup(group, wildRank)
  const meld = seq || isSetGroup(group, wildRank)
  return { meld, sequence: seq, pure }
}

// ── Declaration validation ──────────────────────────────────────────────────────
// hand: array of the player's 13 card objects (the 14th is already discarded).
// groups: array of arrays of card IDs partitioning those 13 cards.
export function validateDeclaration(hand, groups, wildRank) {
  if (!Array.isArray(groups) || groups.length === 0) return { valid: false, reason: 'No arrangement' }
  const byId = new Map(hand.map(c => [c.id, c]))
  const seen = new Set()
  const resolved = []
  for (const g of groups) {
    if (!Array.isArray(g) || g.length < 3) return { valid: false, reason: 'Each group needs at least 3 cards' }
    const cards = []
    for (const id of g) {
      if (!byId.has(id)) return { valid: false, reason: 'Card not in hand' }
      if (seen.has(id)) return { valid: false, reason: 'Card used twice' }
      seen.add(id)
      cards.push(byId.get(id))
    }
    resolved.push(cards)
  }
  if (seen.size !== hand.length) return { valid: false, reason: 'Use all 13 cards' }

  let sequences = 0, pures = 0
  for (const cards of resolved) {
    const { meld, sequence, pure } = classifyGroup(cards, wildRank)
    if (!meld) return { valid: false, reason: 'Invalid group (not a run or set)' }
    if (sequence) sequences++
    if (pure) pures++
  }
  if (pures < 1) return { valid: false, reason: 'Need at least one pure sequence' }
  if (sequences < 2) return { valid: false, reason: 'Need at least two sequences' }
  return { valid: true }
}

// Deadwood / full count for a losing hand: sum of point values, jokers & wilds
// count 0, capped at 80. (v1 charges the full hand — minimal-deadwood scoring
// that credits partial melds is a deferred follow-up.)
export function handPoints(cards, wildRank) {
  let total = 0
  for (const c of cards) {
    if (isWildCard(c, wildRank)) continue
    total += RANK_POINTS[c.rank] || 0
  }
  return Math.min(total, FULL_COUNT_CAP)
}
export const FULL_COUNT = FULL_COUNT_CAP

// Sort helper for tidy client display: by suit, then rank; jokers last.
export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const aj = isPrintedJoker(a), bj = isPrintedJoker(b)
    if (aj !== bj) return aj ? 1 : -1
    if (aj && bj) return 0
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  })
}
