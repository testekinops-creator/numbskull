import { describe, it, expect } from 'vitest'
import { QueensEngine, isValidSolution, countCorrectQueens } from './QueensEngine.js'

// Re-implement the solution counter here (independent of the engine internals) so
// the uniqueness assertion is a genuine cross-check, not the same code under test.
function countSolutions(regions, n, cap = 3) {
  let count = 0
  const usedCol = Array(n).fill(false), usedRegion = Array(n).fill(false), colAt = Array(n).fill(-1)
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

function boardFromSolution(solution) {
  return solution.map(v => (v ? 'queen' : 'empty'))
}

// Every region id 0..n-1 must form a single orthogonally-connected blob covering
// the whole board with no gaps.
function regionsContiguousAndComplete(regions, n) {
  if (regions.length !== n * n) return false
  if (regions.some(r => r < 0 || r >= n)) return false
  const byRegion = new Map()
  regions.forEach((r, i) => { if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(i) })
  if (byRegion.size !== n) return false
  for (const cells of byRegion.values()) {
    const set = new Set(cells)
    const seen = new Set([cells[0]])
    const stack = [cells[0]]
    while (stack.length) {
      const cell = stack.pop()
      const r = Math.floor(cell / n), c = cell % n
      for (const nb of [r > 0 ? cell - n : -1, r < n - 1 ? cell + n : -1, c > 0 ? cell - 1 : -1, c < n - 1 ? cell + 1 : -1]) {
        if (nb >= 0 && set.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb) }
      }
    }
    if (seen.size !== cells.length) return false   // disconnected region
  }
  return true
}

describe('QueensEngine generation', () => {
  it('is deterministic under a seed', () => {
    const a = QueensEngine.generate(8, 12345)
    const b = QueensEngine.generate(8, 12345)
    expect(a.regions).toEqual(b.regions)
    expect(a.solution).toEqual(b.solution)
  })

  it('produces valid, unique, contiguous puzzles across sizes & seeds', () => {
    for (const n of [7, 8, 9]) {
      for (let seed = 1; seed <= 12; seed++) {
        const { regions, solution } = QueensEngine.generate(n, seed)
        // exactly n queens in the solution
        expect(solution.filter(Boolean).length).toBe(n)
        // the solution obeys every rule
        expect(isValidSolution(boardFromSolution(solution), regions, n)).toBe(true)
        // regions tile the board, n contiguous blobs
        expect(regionsContiguousAndComplete(regions, n)).toBe(true)
        // each region contains exactly one solution queen
        const perRegion = Array(n).fill(0)
        solution.forEach((v, i) => { if (v) perRegion[regions[i]]++ })
        expect(perRegion.every(x => x === 1)).toBe(true)
        // THE solution is unique
        expect(countSolutions(regions, n, 3)).toBe(1)
      }
    }
  })
})

describe('isValidSolution', () => {
  const { regions, solution } = QueensEngine.generate(8, 777)
  const n = 8

  it('accepts the generated solution', () => {
    expect(isValidSolution(boardFromSolution(solution), regions, n)).toBe(true)
  })

  it('rejects an incomplete board (a queen missing)', () => {
    const board = boardFromSolution(solution)
    board[solution.indexOf(true)] = 'empty'
    expect(isValidSolution(board, regions, n)).toBe(false)
  })

  it('rejects two queens that touch / break a constraint', () => {
    // Force two queens into the same row adjacent to each other → must fail.
    const board = Array(n * n).fill('empty')
    board[0] = 'queen'; board[1] = 'queen'
    expect(isValidSolution(board, regions, n)).toBe(false)
  })

  it("ignores 'x' marks (only queens count)", () => {
    const board = boardFromSolution(solution).map(c => (c === 'empty' ? 'x' : c))
    expect(isValidSolution(board, regions, n)).toBe(true)
  })
})

describe('countCorrectQueens', () => {
  it('counts only queens on true solution cells', () => {
    const { solution } = QueensEngine.generate(8, 42)
    const board = boardFromSolution(solution)
    expect(countCorrectQueens(board, solution)).toBe(8)
    // misplace one queen onto a non-solution cell
    const wrongIdx = solution.indexOf(false)
    board[solution.indexOf(true)] = 'empty'
    board[wrongIdx] = 'queen'
    expect(countCorrectQueens(board, solution)).toBe(7)
  })
})
