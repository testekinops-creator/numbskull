import { applyMove, absCell, SAFE_CELLS, HOME } from './ludo.js'

// Pick a move for an AI player. Heuristic: finishing > capturing > releasing a
// token from base > advancing the furthest token, with a nudge toward landing
// on a safe cell. Operates on a clone so the real board is untouched.
function clone(tokens) {
  const o = {}
  for (const k in tokens) o[k] = tokens[k].slice()
  return o
}

export function chooseLudoMove(tokens, color, roll, legal) {
  if (!legal || !legal.length) return null
  let best = legal[0]
  let bestScore = -Infinity
  for (const i of legal) {
    const sim = clone(tokens)
    const from = sim[color][i]
    const res = applyMove(sim, color, i, roll)
    const to = sim[color][i]
    let score = to                                  // further along is better
    if (res.finished) score += 1000                 // get a token home
    score += res.captured.length * 320              // sending rivals back is great
    if (from === -1) score += 130                   // releasing from base
    const abs = absCell(color, to)
    if (abs == null || SAFE_CELLS.has(abs)) score += 35   // ends on a safe square
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}
