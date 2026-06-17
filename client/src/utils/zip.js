// Client-side Zip generator + validators — mirror of server/src/game/engines/ZipEngine.js
// so SOLO play is instant/offline and the board can validate the drawn path live.
// Multiplayer stays server-authoritative.
//
// Rules: 6×6 grid, numbered cells 1..K, walls (blocked adjacencies). Draw one path
// 1→K covering every cell exactly once, never crossing a wall. Unique solution.

export const ZIP_SIZE = 6
const WAYPOINTS = { easy: 8, medium: 6, hard: 5 }
const MAX_ATTEMPTS = 40
const HAMILTON_TRIES = 40
const NODE_CAP = 1_500_000

function shuffle(a) {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}
export function neighbors(i, n) {
  const r = (i / n) | 0, c = i % n, out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}
const wkey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
const adjacent = (a, b, n) => {
  const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1)
}

function randomHamiltonianPath(n) {
  const N = n * n
  for (let t = 0; t < HAMILTON_TRIES; t++) {
    const start = Math.floor(Math.random() * N)
    const path = [start]
    const seen = new Array(N).fill(false); seen[start] = true
    const bt = () => {
      if (path.length === N) return true
      const cur = path[path.length - 1]
      for (const nb of shuffle(neighbors(cur, n))) {
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

function countSolutions(n, numAt, K, wallSet, cap = 2) {
  const N = n * n
  const start = numAt.indexOf(1)
  if (start < 0) return { cnt: 0, blown: false }
  const adj = []
  for (let i = 0; i < N; i++) adj.push(neighbors(i, n).filter(j => !wallSet.has(wkey(i, j))))
  const seen = new Array(N).fill(false)
  let cnt = 0, nodes = 0, blown = false
  const stranded = (cur) => {
    for (let i = 0; i < N; i++) {
      if (seen[i] || adj[i].includes(cur)) continue
      if (!adj[i].some(j => !seen[j])) return true
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
      if (m > 0 && m !== nextExp) continue
      seen[nb] = true; bt(nb, count + 1, m > 0 ? nextExp + 1 : nextExp); seen[nb] = false
    }
  }
  seen[start] = true; bt(start, 1, 2)
  return { cnt, blown }
}

// Returns { n, numbers(Int[]), walls([{a,b}]), solution(Int[] path) }.
export function generateZip(difficulty = 'medium') {
  const n = ZIP_SIZE, N = n * n, K = WAYPOINTS[difficulty] ?? WAYPOINTS.medium
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sol = randomHamiltonianPath(n)
    if (!sol) continue
    const numAt = new Array(N).fill(0)
    const posSet = new Set([0, N - 1])
    for (let k = 1; k < K - 1; k++) posSet.add(Math.round((k * (N - 1)) / (K - 1)))
    const positions = [...posSet].sort((a, b) => a - b)
    positions.forEach((p, idx) => { numAt[sol[p]] = idx + 1 })
    const Kactual = positions.length

    const used = new Set()
    for (let i = 0; i + 1 < sol.length; i++) used.add(wkey(sol[i], sol[i + 1]))
    const allEdges = new Set()
    for (let i = 0; i < N; i++) for (const j of neighbors(i, n)) allEdges.add(wkey(i, j))
    const cand = shuffle([...allEdges].filter(w => !used.has(w)))

    const wallSet = new Set()
    let ci = 0, ok = false, guard = 0, blew = false
    while (guard++ < 600) {
      const r = countSolutions(n, numAt, Kactual, wallSet, 2)
      if (r.blown) { blew = true; break }
      if (r.cnt === 1) { ok = true; break }
      if (ci < cand.length) wallSet.add(cand[ci++]); else break
    }
    if (blew || !ok) continue
    for (const w of [...wallSet]) {
      wallSet.delete(w)
      if (countSolutions(n, numAt, Kactual, wallSet, 2).cnt !== 1) wallSet.add(w)
    }
    const walls = [...wallSet].map(w => { const [a, b] = w.split('-').map(Number); return { a, b } })
    return { n, numbers: numAt, walls, solution: sol }
  }
  throw new Error('Zip generation failed')
}

function wallLookup(walls) { const s = new Set(); for (const { a, b } of walls) s.add(wkey(a, b)); return s }

export function zipIsValidSolution(path, n, numbers, walls = []) {
  const N = n * n
  if (!Array.isArray(path) || path.length !== N || new Set(path).size !== N) return false
  const ws = wallLookup(walls)
  const K = Math.max(0, ...numbers)
  let expect = 1
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]
    if (cell < 0 || cell >= N) return false
    if (i > 0) { const prev = path[i - 1]; if (!adjacent(prev, cell, n) || ws.has(wkey(prev, cell))) return false }
    const num = numbers[cell]
    if (num > 0) { if (num !== expect) return false; expect++ }
  }
  return expect === K + 1 && numbers[path[0]] === 1 && numbers[path[path.length - 1]] === K
}

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
    if (i > 0) { const prev = path[i - 1]; if (!adjacent(prev, cell, n) || ws.has(wkey(prev, cell))) return false }
    const num = numbers[cell]
    if (num > 0) { if (num !== expect) return false; expect++ }
  }
  return true
}

// Can cell `b` legally extend a path currently ending at `a`? (adjacent, not walled)
export function canExtend(a, b, n, walls) {
  return adjacent(a, b, n) && !wallLookup(walls).has(wkey(a, b))
}
