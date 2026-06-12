// Client-side Sudoku generator + helpers for SOLO play. Solo holds the solution
// locally (no opponent to cheat, works offline, no server round-trip per cell).
// Multiplayer keeps using the server engine — this file is solo-only.
//
// Grid is a flat length-81 array, row-major. 0 = empty cell.

function rnd(n) { return Math.floor(Math.random() * n) }

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// More givens = easier. Mirrors the server engine's targets.
const GIVENS = { easy: 42, medium: 34, hard: 28 }

// The 20 peers (same row / column / 3×3 box) of every cell, precomputed once.
const PEERS = (() => {
  const peers = []
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9), col = i % 9
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3
    const set = new Set()
    for (let k = 0; k < 9; k++) {
      set.add(row * 9 + k)      // row
      set.add(k * 9 + col)      // column
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) set.add((br + r) * 9 + (bc + c)) // box
    set.delete(i)
    peers.push([...set])
  }
  return peers
})()

export function peersOf(index) { return PEERS[index] }

// May value v be placed at cell `index` without breaking row/col/box?
export function isSafe(grid, index, v) {
  for (const p of PEERS[index]) if (grid[p] === v) return false
  return true
}

// Fill an empty grid with a complete, valid solution via randomized backtracking.
function solveFull(grid) {
  const idx = grid.indexOf(0)
  if (idx === -1) return true
  for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (isSafe(grid, idx, v)) {
      grid[idx] = v
      if (solveFull(grid)) return true
      grid[idx] = 0
    }
  }
  return false
}

export function fullGrid() {
  const grid = Array(81).fill(0)
  solveFull(grid)
  return grid
}

// Count solutions, early-exiting at `cap` (we only ever care whether it's 1 or >1).
// Picks the most-constrained empty cell first so uniqueness checks stay fast.
export function countSolutions(grid, cap = 2) {
  const work = [...grid]
  let count = 0

  const recurse = () => {
    // Find the empty cell with the fewest legal candidates (MRV heuristic).
    let best = -1, bestCands = null
    for (let i = 0; i < 81; i++) {
      if (work[i] !== 0) continue
      const cands = []
      for (let v = 1; v <= 9; v++) if (isSafe(work, i, v)) cands.push(v)
      if (cands.length === 0) return            // dead end → no solution down here
      if (bestCands === null || cands.length < bestCands.length) {
        best = i; bestCands = cands
        if (cands.length === 1) break           // can't do better than a forced cell
      }
    }
    if (best === -1) { count++; return }         // no empties → a full solution
    for (const v of bestCands) {
      work[best] = v
      recurse()
      work[best] = 0
      if (count >= cap) return
    }
  }

  recurse()
  return count
}

// Generate a puzzle whose solution is UNIQUE. We dig holes from a full grid in a
// random order, keeping a removal only if the puzzle still has exactly one
// solution. Symmetric removal (cell + its 180° partner) keeps the board tidy.
export function generate(difficulty = 'medium') {
  const solution = fullGrid()
  const target = GIVENS[difficulty] ?? GIVENS.medium
  const toRemove = 81 - target

  const puzzle = [...solution]
  let removed = 0
  for (const i of shuffled([...Array(81).keys()])) {
    if (removed >= toRemove) break
    const partner = 80 - i
    const cells = i === partner ? [i] : [i, partner]
    if (cells.some(c => puzzle[c] === 0)) continue   // already emptied

    const backup = cells.map(c => puzzle[c])
    cells.forEach(c => { puzzle[c] = 0 })

    // Keep the dig only if the solution stays unique; otherwise put it back.
    if (countSolutions(puzzle, 2) === 1) {
      removed += cells.length
    } else {
      cells.forEach((c, k) => { puzzle[c] = backup[k] })
    }
  }

  const givens = puzzle.map(v => v !== 0)
  return { puzzle, solution, givens }
}

// Indices of cells whose value duplicates within their row, column, or box.
export function conflictsOf(grid) {
  const conflict = new Set()
  const scan = (cells) => {
    const seen = {}
    for (const i of cells) {
      const v = grid[i]
      if (!v) continue
      if (seen[v] != null) { conflict.add(i); conflict.add(seen[v]) }
      else seen[v] = i
    }
  }
  for (let r = 0; r < 9; r++) scan(Array.from({ length: 9 }, (_, c) => r * 9 + c))
  for (let c = 0; c < 9; c++) scan(Array.from({ length: 9 }, (_, r) => r * 9 + c))
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3
    scan(Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + (bc + k % 3)))
  }
  return conflict
}
