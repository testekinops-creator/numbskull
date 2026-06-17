// Queens — LinkedIn-style logic puzzle, pure rules+generation engine (no I/O).
// The socket layer (matchHandlers.js) owns room/race state + broadcasting; this
// engine owns puzzle GENERATION (the hard part: a board with a guaranteed UNIQUE
// solution) and rule validation. The solution is held server-side and never sent.
//
// Rules: an n×n grid split into n contiguous colored REGIONS. Place exactly one
// queen per row, per column AND per region, and NO two queens may touch — not even
// diagonally (8-neighbour adjacency). Because we place one queen per row and the
// rows are distinct, two queens can only touch if they sit in ADJACENT rows with
// column difference ≤ 1 — so generation/solving only needs to compare each row
// with the one above it.
//
// Data is plain + JSON-serialisable so it can live on `room.match` (and Redis):
//   regions  : Int[n*n] region id (0..n-1), row-major — PUBLIC (the colored board)
//   solution : Bool[n*n] true where the unique solution has a queen — SERVER ONLY

import { randomInt } from 'node:crypto'

const SIZE = { easy: 7, medium: 8, hard: 9 }
const MAX_PUZZLE_ATTEMPTS = 60    // each attempt = fresh placement + regions + repair-to-unique
const REPAIR_MAX_ITER = 3000      // boundary mutations per repair pass
const REPAIR_STUCK_LIMIT = 300    // give up a pass after this many non-improving moves
const OBJ_CAP = 60                // count solutions up to this for the hill-climb objective

// Seeded PRNG for deterministic tests; crypto-random in production.
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

function shuffledRange(n, rng) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// One queen per row & column, with adjacent rows differing by ≥2 columns (so no
// two touch). Returns col-per-row (length n) or null if it dead-ends.
function placeQueens(n, rng) {
  const col = new Array(n).fill(-1)
  const usedCol = new Array(n).fill(false)
  const bt = (row) => {
    if (row === n) return true
    for (const c of shuffledRange(n, rng)) {
      if (usedCol[c]) continue
      if (row > 0 && Math.abs(c - col[row - 1]) < 2) continue  // would touch the row above
      col[row] = c; usedCol[c] = true
      if (bt(row + 1)) return true
      col[row] = -1; usedCol[c] = false
    }
    return false
  }
  return bt(0) ? col : null
}

function orthNeighbors(cell, n) {
  const r = Math.floor(cell / n), c = cell % n
  const out = []
  if (r > 0)     out.push(cell - n)
  if (r < n - 1) out.push(cell + n)
  if (c > 0)     out.push(cell - 1)
  if (c < n - 1) out.push(cell + 1)
  return out
}

// Multi-source random flood-fill: seed each region at its queen cell, then grow
// into random unassigned orthogonal neighbours. Every region stays contiguous and
// holds exactly its one seed queen. Returns Int[n*n] region ids (or null on guard).
function growRegions(n, queenCol, rng) {
  const N = n * n
  const region = new Array(N).fill(-1)
  let active = []
  for (let row = 0; row < n; row++) {
    const cell = row * n + queenCol[row]
    region[cell] = row          // region id = row index of its seed queen
    active.push(cell)
  }
  let remaining = N - n
  while (remaining > 0 && active.length) {
    const ai = Math.floor(rng() * active.length)
    const cell = active[ai]
    const open = orthNeighbors(cell, n).filter(x => region[x] === -1)
    if (open.length === 0) {              // exhausted — drop from the active set
      active[ai] = active[active.length - 1]; active.pop()
      continue
    }
    const pick = open[Math.floor(rng() * open.length)]
    region[pick] = region[cell]
    active.push(pick)
    remaining--
  }
  return remaining === 0 ? region : null
}

function cellsOfRegion(regions, g) {
  const out = []
  for (let i = 0; i < regions.length; i++) if (regions[i] === g) out.push(i)
  return out
}

// Would region `g` stay orthogonally connected if cell `x` were removed from it?
function connectedWithout(regions, n, g, x) {
  const cells = cellsOfRegion(regions, g).filter(c => c !== x)
  if (cells.length === 0) return false
  const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]]
  while (stack.length) {
    const c = stack.pop()
    for (const nb of orthNeighbors(c, n)) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb) }
  }
  return seen.size === cells.length
}

// Hill-climb: repeatedly move a boundary cell from its region into an adjacent one
// — never the region's seed queen, and only if the donor stays contiguous — to
// drive the solution count toward exactly 1. Each region keeps its single queen
// throughout (we never move a seed, and the receiver only gains a non-queen cell),
// so the target placement stays valid. Returns a unique region map or null.
function repairToUnique(regions, n, queenCol, rng) {
  const reg = [...regions]
  const seedCell = new Array(n)
  for (let row = 0; row < n; row++) seedCell[row] = row * n + queenCol[row]  // region id == row
  let best = countSolutions(reg, n, OBJ_CAP)
  let stuck = 0
  for (let it = 0; it < REPAIR_MAX_ITER; it++) {
    if (best === 1) return reg
    // candidate boundary cells: not a seed, and touching a different region
    const movable = []
    for (let x = 0; x < n * n; x++) {
      const g = reg[x]
      if (x === seedCell[g]) continue
      if (orthNeighbors(x, n).some(nb => reg[nb] !== g)) movable.push(x)
    }
    if (movable.length === 0) return null
    const x = movable[Math.floor(rng() * movable.length)]
    const g = reg[x]
    const targets = [...new Set(orthNeighbors(x, n).map(nb => reg[nb]).filter(h => h !== g))]
    const h = targets[Math.floor(rng() * targets.length)]
    if (!connectedWithout(reg, n, g, x)) { stuck++; if (stuck > REPAIR_STUCK_LIMIT) return null; continue }
    reg[x] = h
    const c = countSolutions(reg, n, OBJ_CAP)
    if (c <= best || rng() < 0.04) {          // accept improving / equal / occasional sideways
      stuck = c < best ? 0 : stuck + 1
      best = c
    } else {
      reg[x] = g                              // revert
      stuck++
    }
    if (stuck > REPAIR_STUCK_LIMIT) return null
  }
  return best === 1 ? reg : null
}

// Count rule-valid full placements for a region map, stopping at `cap` (uniqueness
// only needs to know whether it's exactly 1). Backtracks one queen per row.
function countSolutions(regions, n, cap = 2) {
  let count = 0
  const usedCol = new Array(n).fill(false)
  const usedRegion = new Array(n).fill(false)
  const colAt = new Array(n).fill(-1)
  const bt = (row) => {
    if (count >= cap) return
    if (row === n) { count++; return }
    for (let c = 0; c < n; c++) {
      if (usedCol[c]) continue
      const reg = regions[row * n + c]
      if (usedRegion[reg]) continue
      if (row > 0 && Math.abs(c - colAt[row - 1]) < 2) continue  // touch the row above
      usedCol[c] = true; usedRegion[reg] = true; colAt[row] = c
      bt(row + 1)
      usedCol[c] = false; usedRegion[reg] = false; colAt[row] = -1
    }
  }
  bt(0)
  return count
}

export class QueensEngine {
  constructor({ difficulty = 'medium', seed } = {}) {
    this.difficulty = difficulty
    this.n = SIZE[difficulty] ?? SIZE.medium
    const { regions, solution } = QueensEngine.generate(this.n, seed)
    this.regions = regions      // PUBLIC
    this.solution = solution    // SERVER ONLY
  }

  // Returns { n, regions, solution } with a guaranteed unique solution. Each outer
  // attempt grows fresh random regions then hill-climbs them to uniqueness; a
  // single pass succeeds ~73–99% of the time (by size), so a handful of attempts
  // is effectively certain.
  static generate(n, seed) {
    const rng = makeRng(seed)
    for (let attempt = 0; attempt < MAX_PUZZLE_ATTEMPTS; attempt++) {
      const queenCol = placeQueens(n, rng)
      if (!queenCol) continue
      const grown = growRegions(n, queenCol, rng)
      if (!grown) continue
      const regions = repairToUnique(grown, n, queenCol, rng)
      if (!regions) continue
      const solution = new Array(n * n).fill(false)
      for (let row = 0; row < n; row++) solution[row * n + queenCol[row]] = true
      return { n, regions, solution }
    }
    throw new Error(`Queens generation failed for n=${n}`)
  }
}

// Is a player's board a complete, rule-valid solution? `board` is a flat array of
// 'empty' | 'x' | 'queen'. By uniqueness this is equivalent to matching `solution`,
// but we validate by the rules directly (robust + independent of the solution).
export function isValidSolution(board, regions, n) {
  const queens = []
  for (let i = 0; i < board.length; i++) if (board[i] === 'queen') queens.push(i)
  if (queens.length !== n) return false
  const rows = new Set(), cols = new Set(), regs = new Set()
  for (const i of queens) {
    const r = Math.floor(i / n), c = i % n
    if (rows.has(r) || cols.has(c) || regs.has(regions[i])) return false
    rows.add(r); cols.add(c); regs.add(regions[i])
  }
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const r1 = Math.floor(queens[a] / n), c1 = queens[a] % n
      const r2 = Math.floor(queens[b] / n), c2 = queens[b] % n
      if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) return false
    }
  }
  return true
}

// How many of the player's placed queens sit on a true solution cell — used as the
// time-cap tiebreak (most progress toward the unique solution wins).
export function countCorrectQueens(board, solution) {
  let n = 0
  for (let i = 0; i < board.length; i++) if (board[i] === 'queen' && solution[i]) n++
  return n
}

export { SIZE as QUEENS_SIZE }
