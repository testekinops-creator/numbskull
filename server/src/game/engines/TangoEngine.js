// Tango — LinkedIn-style logic puzzle (Binairo/Takuzu + edge constraints). Pure
// generation + validation; the socket layer (matchHandlers race framework) owns
// the race state. The solution is held server-side and never sent.
//
// Rules: a 6×6 grid filled with ☀️ Sun / 🌙 Moon such that — each row AND column has
// exactly 3 of each; no 3 of the same symbol consecutively (horizontally/vertically);
// edge clues between adjacent cells are `=` (same) or `×` (opposite). Some cells are
// pre-filled (givens). Unique solution.
//
// Internally 0 = sun, 1 = moon. Public/board data uses strings:
//   givens   : ('sun'|'moon'|null)[n*n]            — PUBLIC (pre-filled cells)
//   constraints: { a, b, type:'eq'|'neq' }[]       — PUBLIC (a,b adjacent cell indices)
//   solution : ('sun'|'moon')[n*n]                 — SERVER ONLY

import { randomInt } from 'node:crypto'

const N_DEFAULT = 6
const GIVENS_TARGET = { easy: 12, medium: 6, hard: 2 }   // revealed cells per difficulty
const MAX_ATTEMPTS = 80

const SYM = ['sun', 'moon']
const toSym = (v) => (v === 0 ? 'sun' : v === 1 ? 'moon' : null)
const toInt = (s) => (s === 'sun' ? 0 : s === 'moon' ? 1 : -1)

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function makeRng(seed) {
  return seed == null ? () => randomInt(0, 0x100000000) / 0x100000000 : mulberry32(seed)
}
function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A complete valid grid (Int 0/1) via randomized backtracking, or null.
function fullSolution(n, rng) {
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
    for (const v of shuffle([0, 1], rng)) {
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
    if (!m.has(a)) m.set(a, [])
    if (!m.has(b)) m.set(b, [])
    m.get(a).push({ other: b, type })
    m.get(b).push({ other: a, type })
  }
  return m
}

// Count rule-valid completions of (givens + constraints), stopping at `cap`.
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
    if (fixed[i] !== -1) {
      if (!fits(i, fixed[i])) return
      place(i, fixed[i]); bt(i + 1); unplace(i, fixed[i]); return
    }
    for (const v of [0, 1]) {
      if (!fits(i, v)) continue
      place(i, v); bt(i + 1); unplace(i, v)
    }
  }
  bt(0)
  return cnt
}

export class TangoEngine {
  constructor({ difficulty = 'medium', seed } = {}) {
    this.difficulty = difficulty
    this.n = N_DEFAULT
    const { givens, constraints, solution } = TangoEngine.generate(this.n, difficulty, seed)
    this.givens = givens            // PUBLIC
    this.constraints = constraints  // PUBLIC
    this.solution = solution        // SERVER ONLY
  }

  static generate(n = N_DEFAULT, difficulty = 'medium', seed) {
    const rng = makeRng(seed)
    const N = n * n
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sol = fullSolution(n, rng)
      if (!sol) continue
      const edges = shuffle(allEdges(n), rng).map(([a, b]) => ({ a, b, type: sol[a] === sol[b] ? 'eq' : 'neq' }))
      let givens = new Array(N).fill(-1)
      let chosen = []
      let ei = 0, guard = 0, ok = false
      while (guard++ < 400) {
        if (countSolutions(givens, consMap(chosen), n, 2) === 1) { ok = true; break }
        if (ei < edges.length) { chosen.push(edges[ei++]) }
        else {
          const empties = []
          for (let k = 0; k < N; k++) if (givens[k] === -1) empties.push(k)
          if (!empties.length) break
          const k = empties[Math.floor(rng() * empties.length)]
          givens[k] = sol[k]
        }
      }
      if (!ok) continue

      // Minimise constraints (cleaner board), then minimise givens.
      for (let k = chosen.length - 1; k >= 0; k--) {
        const trial = chosen.slice(0, k).concat(chosen.slice(k + 1))
        if (countSolutions(givens, consMap(trial), n, 2) === 1) chosen = trial
      }
      for (let k = 0; k < N; k++) {
        if (givens[k] === -1) continue
        const v = givens[k]; givens[k] = -1
        if (countSolutions(givens, consMap(chosen), n, 2) !== 1) givens[k] = v
      }

      // Add extra givens up to the difficulty target (extra givens never break
      // uniqueness — they only constrain further), making easier levels easier.
      const target = GIVENS_TARGET[difficulty] ?? GIVENS_TARGET.medium
      const empties = shuffle([...Array(N).keys()].filter(k => givens[k] === -1), rng)
      for (const k of empties) {
        if (givens.filter(x => x !== -1).length >= target) break
        givens[k] = sol[k]
      }

      return {
        n,
        givens: givens.map(toSym),
        constraints: chosen,
        solution: sol.map(v => toSym(v)),
      }
    }
    throw new Error(`Tango generation failed for n=${n}`)
  }
}

// Is a player's board a complete, rule-valid solution? `board` is flat
// 'sun'|'moon'|'empty'. Validated by the rules directly (robust + given-aware via
// the board already containing the givens).
export function tangoIsValidSolution(board, n, constraints = []) {
  const N = n * n, HALF = n / 2
  const v = board.map(toInt)
  if (v.some(x => x !== 0 && x !== 1)) return false        // any empty/invalid
  // row & column balance
  for (let r = 0; r < n; r++) {
    let ones = 0
    for (let c = 0; c < n; c++) ones += v[r * n + c]
    if (ones !== HALF) return false
  }
  for (let c = 0; c < n; c++) {
    let ones = 0
    for (let r = 0; r < n; r++) ones += v[r * n + c]
    if (ones !== HALF) return false
  }
  // no 3-in-a-row (rows & columns)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c
      if (c >= 2 && v[i] === v[i - 1] && v[i] === v[i - 2]) return false
      if (r >= 2 && v[i] === v[i - n] && v[i] === v[i - 2 * n]) return false
    }
  }
  // edge constraints
  for (const { a, b, type } of constraints) {
    if (type === 'eq' && v[a] !== v[b]) return false
    if (type === 'neq' && v[a] === v[b]) return false
  }
  return true
}

// How many filled cells match the solution — time-cap tiebreak (most progress).
export function tangoCountCorrect(board, solution) {
  let n = 0
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 'empty' && board[i] === solution[i]) n++
  }
  return n
}

export { N_DEFAULT as TANGO_SIZE }
