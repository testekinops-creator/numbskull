// Zip — LinkedIn-style path puzzle. Pure generation + validation; the socket race
// framework (matchHandlers) owns the race state. The solution path is server-only.
//
// Rules: a 6×6 grid with numbered cells 1..K and some WALLS (blocked adjacencies).
// Draw ONE path through orthogonally-adjacent cells that starts at 1, visits 2..K in
// order, covers EVERY cell exactly once, and never crosses a wall. Unique solution.
//
// Data:
//   numbers : Int[n*n]  cell → waypoint number (1..K) or 0          — PUBLIC
//   walls   : { a, b }[] blocked adjacencies (a<b)                  — PUBLIC
//   solution: Int[]      the ordered cell-index path                — SERVER ONLY

import { randomInt } from 'node:crypto'

const N_DEFAULT = 6
const WAYPOINTS = { easy: 8, medium: 6, hard: 5 }   // more numbers = more guidance = easier
const MAX_ATTEMPTS = 40
const HAMILTON_TRIES = 40
const NODE_CAP = 1_500_000

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

export function neighbors(i, n) {
  const r = (i / n) | 0, c = i % n, out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}
function wkey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}` }

// A random Hamiltonian path (visits every cell once), or null.
function randomHamiltonianPath(n, rng) {
  const N = n * n
  for (let tries = 0; tries < HAMILTON_TRIES; tries++) {
    const start = Math.floor(rng() * N)
    const path = [start]
    const seen = new Array(N).fill(false)
    seen[start] = true
    const bt = () => {
      if (path.length === N) return true
      const cur = path[path.length - 1]
      for (const nb of shuffle(neighbors(cur, n), rng)) {
        if (seen[nb]) continue
        seen[nb] = true; path.push(nb)
        if (bt()) return true
        path.pop(); seen[nb] = false
      }
      return false
    }
    if (bt()) return path
  }
  return null
}

// Count Hamiltonian paths that hit the numbered cells in increasing order and
// respect walls, stopping at `cap`. Returns { cnt, blown } (blown = node-cap hit).
function countSolutions(n, numAt, K, wallSet, cap = 2) {
  const N = n * n
  const start = numAt.indexOf(1)
  if (start < 0) return { cnt: 0, blown: false }
  const adj = []
  for (let i = 0; i < N; i++) adj.push(neighbors(i, n).filter(j => !wallSet.has(wkey(i, j))))
  const seen = new Array(N).fill(false)
  let cnt = 0, nodes = 0, blown = false
  // Safe dead-end prune: an unvisited cell that is neither adjacent to the current
  // cell nor has any unvisited neighbour can never be reached → prune. (Never
  // prunes a valid path — the endpoint stays reachable from `cur` on the last step.)
  const stranded = (cur) => {
    for (let i = 0; i < N; i++) {
      if (seen[i] || adj[i].includes(cur)) continue
      let ok = false
      for (const j of adj[i]) if (!seen[j]) { ok = true; break }
      if (!ok) return true
    }
    return false
  }
  const bt = (cur, count, nextExp) => {
    if (cnt >= cap || blown) return
    if (++nodes > NODE_CAP) { blown = true; return }
    if (count === N) { if (nextExp === K + 1 && numAt[cur] === K) cnt++; return }
    if (stranded(cur)) return
    for (const nb of adj[cur]) {
      if (seen[nb]) continue
      const m = numAt[nb]
      if (m > 0 && m !== nextExp) continue       // numbers must be hit in order
      seen[nb] = true
      bt(nb, count + 1, m > 0 ? nextExp + 1 : nextExp)
      seen[nb] = false
    }
  }
  seen[start] = true
  bt(start, 1, 2)
  return { cnt, blown }
}

export class ZipEngine {
  constructor({ difficulty = 'medium', seed } = {}) {
    this.difficulty = difficulty
    this.n = N_DEFAULT
    const { n, numbers, walls, solution } = ZipEngine.generate(this.n, difficulty, seed)
    this.n = n
    this.numbers = numbers    // PUBLIC
    this.walls = walls        // PUBLIC
    this.solution = solution  // SERVER ONLY
  }

  static generate(n = N_DEFAULT, difficulty = 'medium', seed) {
    const rng = makeRng(seed)
    const N = n * n
    const K = WAYPOINTS[difficulty] ?? WAYPOINTS.medium
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const sol = randomHamiltonianPath(n, rng)
      if (!sol) continue
      // Waypoints: 1 at the start, K at the end, the rest spaced along the path.
      const numAt = new Array(N).fill(0)
      const posSet = new Set([0, N - 1])
      for (let k = 1; k < K - 1; k++) posSet.add(Math.round((k * (N - 1)) / (K - 1)))
      const positions = [...posSet].sort((a, b) => a - b)
      positions.forEach((p, idx) => { numAt[sol[p]] = idx + 1 })
      const Kactual = positions.length

      // Candidate walls = adjacencies the solution path does NOT use.
      const used = new Set()
      for (let i = 0; i + 1 < sol.length; i++) used.add(wkey(sol[i], sol[i + 1]))
      const allEdges = new Set()
      for (let i = 0; i < N; i++) for (const j of neighbors(i, n)) allEdges.add(wkey(i, j))
      const cand = shuffle([...allEdges].filter(w => !used.has(w)), rng)

      const wallSet = new Set()
      let ci = 0, ok = false, guard = 0, blew = false
      while (guard++ < 600) {
        const r = countSolutions(n, numAt, Kactual, wallSet, 2)
        if (r.blown) { blew = true; break }
        if (r.cnt === 1) { ok = true; break }
        if (ci < cand.length) wallSet.add(cand[ci++])
        else break
      }
      if (blew || !ok) continue

      // Minimise walls (drop any that aren't needed for uniqueness) — cleaner board.
      for (const w of [...wallSet]) {
        wallSet.delete(w)
        if (countSolutions(n, numAt, Kactual, wallSet, 2).cnt !== 1) wallSet.add(w)
      }

      const walls = [...wallSet].map(w => { const [a, b] = w.split('-').map(Number); return { a, b } })
      return { n, numbers: numAt, walls, solution: sol }
    }
    throw new Error(`Zip generation failed for n=${n}`)
  }
}

function wallLookup(walls) {
  const s = new Set()
  for (const { a, b } of walls) s.add(wkey(a, b))
  return s
}
function adjacent(a, b, n) {
  const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1)
}

// Is `path` a complete, rule-valid solution? (full coverage, adjacency, no wall
// cross, numbers hit 1..K in order, starts at 1 / ends at K).
export function zipIsValidSolution(path, n, numbers, walls = []) {
  const N = n * n
  if (!Array.isArray(path) || path.length !== N) return false
  if (new Set(path).size !== N) return false
  const ws = wallLookup(walls)
  const K = Math.max(0, ...numbers)
  let expect = 1
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]
    if (cell < 0 || cell >= N) return false
    if (i > 0) {
      const prev = path[i - 1]
      if (!adjacent(prev, cell, n) || ws.has(wkey(prev, cell))) return false
    }
    const num = numbers[cell]
    if (num > 0) { if (num !== expect) return false; expect++ }
  }
  return expect === K + 1 && numbers[path[0]] === 1 && numbers[path[path.length - 1]] === K
}

// Is `path` a legal in-progress prefix? (distinct, adjacent, no wall cross, starts at
// the "1" cell when non-empty, numbered cells so far hit in order). Server anti-cheat.
export function zipIsValidPartial(path, n, numbers, walls = []) {
  const N = n * n
  if (!Array.isArray(path)) return false
  if (path.length === 0) return true
  if (new Set(path).size !== path.length) return false
  if (numbers[path[0]] !== 1) return false
  const ws = wallLookup(walls)
  let expect = 1
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]
    if (!Number.isInteger(cell) || cell < 0 || cell >= N) return false
    if (i > 0) {
      const prev = path[i - 1]
      if (!adjacent(prev, cell, n) || ws.has(wkey(prev, cell))) return false
    }
    const num = numbers[cell]
    if (num > 0) { if (num !== expect) return false; expect++ }
  }
  return true
}

export function zipProgress(path) { return Array.isArray(path) ? path.length : 0 }

export { N_DEFAULT as ZIP_SIZE }
