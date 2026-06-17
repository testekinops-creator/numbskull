// Client-side Queens puzzle generator + validators — a mirror of the server
// engine (server/src/game/engines/QueensEngine.js) so SOLO play is instant and
// offline (exactly how Sudoku solo works). Multiplayer stays server-authoritative;
// this is only used for solo generation and for in-board conflict highlighting.
//
// Rules: n×n grid, n colored regions; one queen per row, per column AND per region;
// no two queens may touch (8-neighbour). Unique solution guaranteed.

export const QUEENS_SIZE = { easy: 7, medium: 8, hard: 9 }

// Distinct region fill colors (used at low opacity over the dark board).
export const REGION_COLORS = [
  '#7c4dff', '#00bcd4', '#ff7043', '#66bb6a', '#ec407a',
  '#ffca28', '#26a69a', '#5c6bc0', '#bdbd6b',
]

const MAX_PUZZLE_ATTEMPTS = 60
const REPAIR_MAX_ITER = 3000
const REPAIR_STUCK_LIMIT = 300
const OBJ_CAP = 60

function shuffledRange(n) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function placeQueens(n) {
  const col = new Array(n).fill(-1)
  const usedCol = new Array(n).fill(false)
  const bt = (row) => {
    if (row === n) return true
    for (const c of shuffledRange(n)) {
      if (usedCol[c]) continue
      if (row > 0 && Math.abs(c - col[row - 1]) < 2) continue
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
  if (r > 0) out.push(cell - n)
  if (r < n - 1) out.push(cell + n)
  if (c > 0) out.push(cell - 1)
  if (c < n - 1) out.push(cell + 1)
  return out
}

function growRegions(n, queenCol) {
  const N = n * n
  const region = new Array(N).fill(-1)
  let active = []
  for (let row = 0; row < n; row++) {
    const cell = row * n + queenCol[row]
    region[cell] = row
    active.push(cell)
  }
  let remaining = N - n
  while (remaining > 0 && active.length) {
    const ai = Math.floor(Math.random() * active.length)
    const cell = active[ai]
    const open = orthNeighbors(cell, n).filter(x => region[x] === -1)
    if (open.length === 0) { active[ai] = active[active.length - 1]; active.pop(); continue }
    const pick = open[Math.floor(Math.random() * open.length)]
    region[pick] = region[cell]
    active.push(pick)
    remaining--
  }
  return remaining === 0 ? region : null
}

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
      if (row > 0 && Math.abs(c - colAt[row - 1]) < 2) continue
      usedCol[c] = true; usedRegion[reg] = true; colAt[row] = c
      bt(row + 1)
      usedCol[c] = false; usedRegion[reg] = false; colAt[row] = -1
    }
  }
  bt(0)
  return count
}

function cellsOfRegion(regions, g) {
  const out = []
  for (let i = 0; i < regions.length; i++) if (regions[i] === g) out.push(i)
  return out
}

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

function repairToUnique(regions, n, queenCol) {
  const reg = [...regions]
  const seedCell = new Array(n)
  for (let row = 0; row < n; row++) seedCell[row] = row * n + queenCol[row]
  let best = countSolutions(reg, n, OBJ_CAP)
  let stuck = 0
  for (let it = 0; it < REPAIR_MAX_ITER; it++) {
    if (best === 1) return reg
    const movable = []
    for (let x = 0; x < n * n; x++) {
      const g = reg[x]
      if (x === seedCell[g]) continue
      if (orthNeighbors(x, n).some(nb => reg[nb] !== g)) movable.push(x)
    }
    if (movable.length === 0) return null
    const x = movable[Math.floor(Math.random() * movable.length)]
    const g = reg[x]
    const targets = [...new Set(orthNeighbors(x, n).map(nb => reg[nb]).filter(h => h !== g))]
    const h = targets[Math.floor(Math.random() * targets.length)]
    if (!connectedWithout(reg, n, g, x)) { stuck++; if (stuck > REPAIR_STUCK_LIMIT) return null; continue }
    reg[x] = h
    const c = countSolutions(reg, n, OBJ_CAP)
    if (c <= best || Math.random() < 0.04) { stuck = c < best ? 0 : stuck + 1; best = c }
    else { reg[x] = g; stuck++ }
    if (stuck > REPAIR_STUCK_LIMIT) return null
  }
  return best === 1 ? reg : null
}

// Returns { n, regions, solution(boolean[]) } with a unique solution.
export function generateQueens(difficulty = 'medium') {
  const n = QUEENS_SIZE[difficulty] ?? QUEENS_SIZE.medium
  for (let attempt = 0; attempt < MAX_PUZZLE_ATTEMPTS; attempt++) {
    const queenCol = placeQueens(n)
    if (!queenCol) continue
    const grown = growRegions(n, queenCol)
    if (!grown) continue
    const regions = repairToUnique(grown, n, queenCol)
    if (!regions) continue
    const solution = new Array(n * n).fill(false)
    for (let row = 0; row < n; row++) solution[row * n + queenCol[row]] = true
    return { n, regions, solution }
  }
  throw new Error(`Queens generation failed for n=${n}`)
}

// Flat board of 'empty'|'x'|'queen' → is it a complete, rule-valid solution?
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

// Indices of queens currently in conflict (share row/col/region or touch) — drives
// the live red highlight so players can self-correct.
export function conflictCells(board, regions, n) {
  const bad = new Set()
  const queens = []
  for (let i = 0; i < board.length; i++) if (board[i] === 'queen') queens.push(i)
  const groups = { row: {}, col: {}, reg: {} }
  for (const i of queens) {
    const r = Math.floor(i / n), c = i % n, g = regions[i]
    ;(groups.row[r] ||= []).push(i)
    ;(groups.col[c] ||= []).push(i)
    ;(groups.reg[g] ||= []).push(i)
  }
  for (const dim of Object.values(groups)) {
    for (const grp of Object.values(dim)) if (grp.length > 1) grp.forEach(i => bad.add(i))
  }
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const r1 = Math.floor(queens[a] / n), c1 = queens[a] % n
      const r2 = Math.floor(queens[b] / n), c2 = queens[b] % n
      if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) { bad.add(queens[a]); bad.add(queens[b]) }
    }
  }
  return bad
}
