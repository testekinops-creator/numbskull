// Ludo rules engine (server-authoritative, grid-agnostic). The client owns the
// board geometry; here we only model the logical path each token travels.
//
// Token position `pos` per token:
//   -1            in base (yard)
//   0..50         on the shared main loop, RELATIVE to the player's own start
//                 (51 cells). Absolute loop cell = (START_OFFSET[color] + pos) % 52.
//   51..56        the player's private home column (6 cells); 56 = HOME (finished).
// A token needs an exact roll to land on 56 — overshooting it is illegal.

export const COLORS = ['red', 'green', 'yellow', 'blue']

// Where each colour joins the 52-cell shared loop (standard Ludo offsets).
export const START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 }

export const TRACK_LEN = 52
export const HOME = 56          // pos value meaning "reached center / finished"

// Safe cells (no captures): the 4 coloured start cells + the 4 star cells.
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47])

// 2 players sit opposite (fairest); 3 use three corners; 4 use all.
export function colorsFor(n) {
  if (n <= 2) return ['red', 'yellow']
  if (n === 3) return ['red', 'green', 'yellow']
  return ['red', 'green', 'yellow', 'blue']
}

// Fresh token map for the playing colours — all 4 tokens of each in base.
export function initTokens(colors) {
  const t = {}
  for (const c of colors) t[c] = [-1, -1, -1, -1]
  return t
}

// Absolute loop cell for a token on the main track, else null (base / home column).
export function absCell(color, pos) {
  if (pos < 0 || pos > 50) return null
  return (START_OFFSET[color] + pos) % TRACK_LEN
}

// Absolute loop cells holding an OPPONENT block (2+ tokens of one other colour).
// `color` may neither pass over nor land on these. A pair on a cell can't be
// captured either (you can't land on it). Your own pairs never block you.
export function blockedCells(tokens, color) {
  const blocks = new Set()
  for (const c of Object.keys(tokens)) {
    if (c === color) continue
    const counts = {}
    tokens[c].forEach(p => {
      const abs = absCell(c, p)
      if (abs != null) counts[abs] = (counts[abs] || 0) + 1
    })
    for (const abs in counts) if (counts[abs] >= 2) blocks.add(Number(abs))
  }
  return blocks
}

// Which of a colour's tokens (indices 0..3) may legally move with this roll.
// A move is illegal if its path passes over OR lands on an opponent block.
export function legalMoves(tokens, color, roll) {
  const mine = tokens[color] || []
  const blocks = blockedCells(tokens, color)
  const res = []
  mine.forEach((pos, i) => {
    if (pos === HOME) return                          // already home
    if (pos === -1) {                                 // release needs a 6…
      if (roll === 6 && !blocks.has(START_OFFSET[color])) res.push(i)  // …onto a free start
      return
    }
    const newPos = pos + roll
    if (newPos > HOME) return                         // would overshoot home
    // every loop cell stepped through (incl. the landing cell) must be block-free
    let clear = true
    for (let p = pos + 1; p <= Math.min(newPos, 50); p++) {
      if (blocks.has((START_OFFSET[color] + p) % TRACK_LEN)) { clear = false; break }
    }
    if (clear) res.push(i)
  })
  return res
}

// Apply a (pre-validated) move in place. Returns { captured:[{color,i}], finished }.
export function applyMove(tokens, color, tokenIdx, roll) {
  const mine = tokens[color]
  let pos = mine[tokenIdx]
  pos = pos === -1 ? 0 : pos + roll          // release → start cell (0), else advance
  mine[tokenIdx] = pos

  const captured = []
  const abs = absCell(color, pos)
  if (abs != null && !SAFE_CELLS.has(abs)) {
    for (const c of Object.keys(tokens)) {
      if (c === color) continue
      tokens[c].forEach((p, j) => {
        if (p >= 0 && p <= 50 && absCell(c, p) === abs) {
          tokens[c][j] = -1
          captured.push({ color: c, i: j })
        }
      })
    }
  }
  return { captured, finished: pos === HOME }
}

// All four tokens of a colour are home.
export function isWin(tokens, color) {
  return (tokens[color] || []).every(p => p === HOME)
}

// How far a colour has progressed (sum of token positions) — for DNF ranking.
export function progress(tokens, color) {
  return (tokens[color] || []).reduce((s, p) => s + (p === -1 ? 0 : p + 1), 0)
}
