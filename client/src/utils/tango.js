// Client-side Tango generator + validators — a mirror of the server engine
// (server/src/game/engines/TangoEngine.js) so SOLO play is instant/offline and the
// board can highlight conflicts live. Multiplayer stays server-authoritative.
//
// Rules: 6×6; each row/col has exactly 3 ☀️ + 3 🌙; no 3 same in a row/col; edge
// clues `=` (same) / `×` (opposite). Unique solution. Internal 0=sun, 1=moon.

export const TANGO_SIZE = 6
const GIVENS_TARGET = { easy: 12, medium: 6, hard: 2 }
const MAX_ATTEMPTS = 80

const toSym = (v) => (v === 0 ? 'sun' : v === 1 ? 'moon' : null)
const toInt = (s) => (s === 'sun' ? 0 : s === 'moon' ? 1 : -1)

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fullSolution(n) {
  const N = n * n, HALF = n / 2
  const g = new Array(N).fill(-1)
  const rowc = Array.from({ length: n }, () => [0, 0])
  const colc = Array.from({ length: n }, () => [0, 0])
  const fits = (i, v) => {
    const r = (i / n) | 0, c = i % n
    if (c >= 2 && g[i - 1] === v && g[i - 2] === v) return false
    if (r >= 2 && g[i - n] === v && g[i - 2 * n] === v) return false
    if (rowc[r][v] + 1 > HALF) return false
    if (colc[c][v] + 1 > HALF) return false
    return true
  }
  const bt = (i) => {
    if (i === N) return true
    const r = (i / n) | 0, c = i % n
    for (const v of shuffle([0, 1])) {
      if (!fits(i, v)) continue
      g[i] = v; rowc[r][v]++; colc[c][v]++
      if (bt(i + 1)) return true
      g[i] = -1; rowc[r][v]--; colc[c][v]--
    }
    return false
  }
  return bt(0) ? g : null
}

function allEdges(n) {
  const e = []
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n
    if (c < n - 1) e.push([i, i + 1])
    if (r < n - 1) e.push([i, i + n])
  }
  return e
}
function consMap(list) {
  const m = new Map()
  for (const { a, b, type } of list) {
    if (!m.has(a)) m.set(a, []); if (!m.has(b)) m.set(b, [])
    m.get(a).push({ other: b, type }); m.get(b).push({ other: a, type })
  }
  return m
}
function countSolutions(givens, cons, n, cap = 2) {
  const N = n * n, HALF = n / 2
  let cnt = 0
  const g = givens.slice()
  const rowc = Array.from({ length: n }, () => [0, 0])
  const colc = Array.from({ length: n }, () => [0, 0])
  const place = (i, v) => { g[i] = v; rowc[(i / n) | 0][v]++; colc[i % n][v]++ }
  const unplace = (i, v) => { g[i] = -1; rowc[(i / n) | 0][v]--; colc[i % n][v]-- }
  const fits = (i, v) => {
    const r = (i / n) | 0, c = i % n
    if (c >= 2 && g[i - 1] === v && g[i - 2] === v) return false
    if (r >= 2 && g[i - n] === v && g[i - 2 * n] === v) return false
    if (rowc[r][v] + 1 > HALF) return false
    if (colc[c][v] + 1 > HALF) return false
    for (const { other, type } of (cons.get(i) || [])) {
      if (other < i && g[other] !== -1) {
        if (type === 'eq' && g[other] !== v) return false
        if (type === 'neq' && g[other] === v) return false
      }
    }
    return true
  }
  const fixed = givens.slice()
  const bt = (i) => {
    if (cnt >= cap) return
    if (i === N) { cnt++; return }
    if (fixed[i] !== -1) { if (fits(i, fixed[i])) { place(i, fixed[i]); bt(i + 1); unplace(i, fixed[i]) } ; return }
    for (const v of [0, 1]) { if (fits(i, v)) { place(i, v); bt(i + 1); unplace(i, v) } }
  }
  bt(0)
  return cnt
}

// Returns { n, givens('sun'|'moon'|null)[], constraints[{a,b,type}], solution('sun'|'moon')[] }.
export function generateTango(difficulty = 'medium') {
  const n = TANGO_SIZE, N = n * n
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sol = fullSolution(n)
    if (!sol) continue
    const edges = shuffle(allEdges(n)).map(([a, b]) => ({ a, b, type: sol[a] === sol[b] ? 'eq' : 'neq' }))
    let givens = new Array(N).fill(-1)
    let chosen = []
    let ei = 0, guard = 0, ok = false
    while (guard++ < 400) {
      if (countSolutions(givens, consMap(chosen), n, 2) === 1) { ok = true; break }
      if (ei < edges.length) { chosen.push(edges[ei++]) }
      else {
        const empties = []; for (let k = 0; k < N; k++) if (givens[k] === -1) empties.push(k)
        if (!empties.length) break
        const k = empties[Math.floor(Math.random() * empties.length)]
        givens[k] = sol[k]
      }
    }
    if (!ok) continue
    for (let k = chosen.length - 1; k >= 0; k--) {
      const trial = chosen.slice(0, k).concat(chosen.slice(k + 1))
      if (countSolutions(givens, consMap(trial), n, 2) === 1) chosen = trial
    }
    for (let k = 0; k < N; k++) {
      if (givens[k] === -1) continue
      const v = givens[k]; givens[k] = -1
      if (countSolutions(givens, consMap(chosen), n, 2) !== 1) givens[k] = v
    }
    const target = GIVENS_TARGET[difficulty] ?? GIVENS_TARGET.medium
    for (const k of shuffle([...Array(N).keys()].filter(k => givens[k] === -1))) {
      if (givens.filter(x => x !== -1).length >= target) break
      givens[k] = sol[k]
    }
    return { n, givens: givens.map(toSym), constraints: chosen, solution: sol.map(toSym) }
  }
  throw new Error('Tango generation failed')
}

export function tangoIsValidSolution(board, n, constraints = []) {
  const N = n * n, HALF = n / 2
  const v = board.map(toInt)
  if (v.some(x => x !== 0 && x !== 1)) return false
  for (let r = 0; r < n; r++) { let o = 0; for (let c = 0; c < n; c++) o += v[r * n + c]; if (o !== HALF) return false }
  for (let c = 0; c < n; c++) { let o = 0; for (let r = 0; r < n; r++) o += v[r * n + c]; if (o !== HALF) return false }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c
    if (c >= 2 && v[i] === v[i - 1] && v[i] === v[i - 2]) return false
    if (r >= 2 && v[i] === v[i - n] && v[i] === v[i - 2 * n]) return false
  }
  for (const { a, b, type } of constraints) {
    if (type === 'eq' && v[a] !== v[b]) return false
    if (type === 'neq' && v[a] === v[b]) return false
  }
  return true
}

// Cells currently part of a rule violation → live red highlight.
export function conflictCells(board, n, constraints = []) {
  const bad = new Set()
  const v = board.map(toInt)
  const HALF = n / 2
  // 3-in-a-row (filled)
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c
    if (c >= 2 && v[i] !== -1 && v[i] === v[i - 1] && v[i] === v[i - 2]) { bad.add(i); bad.add(i - 1); bad.add(i - 2) }
    if (r >= 2 && v[i] !== -1 && v[i] === v[i - n] && v[i] === v[i - 2 * n]) { bad.add(i); bad.add(i - n); bad.add(i - 2 * n) }
  }
  // row / col over-count of a symbol (> HALF)
  const mark = (cells) => {
    const cnt = [0, 0]; cells.forEach(i => { if (v[i] !== -1) cnt[v[i]]++ })
    ;[0, 1].forEach(sym => { if (cnt[sym] > HALF) cells.forEach(i => { if (v[i] === sym) bad.add(i) }) })
  }
  for (let r = 0; r < n; r++) mark(Array.from({ length: n }, (_, c) => r * n + c))
  for (let c = 0; c < n; c++) mark(Array.from({ length: n }, (_, r) => r * n + c))
  // broken edge constraints (both endpoints filled)
  for (const { a, b, type } of constraints) {
    if (v[a] === -1 || v[b] === -1) continue
    if ((type === 'eq' && v[a] !== v[b]) || (type === 'neq' && v[a] === v[b])) { bad.add(a); bad.add(b) }
  }
  return bad
}
