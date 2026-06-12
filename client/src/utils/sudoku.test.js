import { describe, it, expect } from 'vitest'
import { generate, fullGrid, countSolutions, isSafe, peersOf, conflictsOf } from './sudoku.js'

// A complete grid is valid iff every row, column and 3×3 box is a permutation of 1..9.
function isCompleteValid(grid) {
  if (grid.length !== 81 || grid.some(v => v < 1 || v > 9)) return false
  const ok = (cells) => new Set(cells.map(i => grid[i])).size === 9
  for (let r = 0; r < 9; r++) if (!ok(Array.from({ length: 9 }, (_, c) => r * 9 + c))) return false
  for (let c = 0; c < 9; c++) if (!ok(Array.from({ length: 9 }, (_, r) => r * 9 + c))) return false
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3
    if (!ok(Array.from({ length: 9 }, (_, k) => (br + Math.floor(k / 3)) * 9 + (bc + k % 3)))) return false
  }
  return true
}

describe('sudoku helpers', () => {
  it('peersOf returns 20 unique peers, excluding the cell itself', () => {
    const p = peersOf(40) // centre cell
    expect(p).toHaveLength(20)
    expect(p).not.toContain(40)
    expect(new Set(p).size).toBe(20)
  })

  it('isSafe respects row, column and box', () => {
    const grid = Array(81).fill(0)
    grid[0] = 5
    expect(isSafe(grid, 1, 5)).toBe(false)   // same row
    expect(isSafe(grid, 9, 5)).toBe(false)   // same column
    expect(isSafe(grid, 10, 5)).toBe(false)  // same box
    expect(isSafe(grid, 40, 5)).toBe(true)   // unrelated cell
  })

  it('conflictsOf flags a duplicated value in a row', () => {
    const grid = Array(81).fill(0)
    grid[0] = 7; grid[3] = 7
    const c = conflictsOf(grid)
    expect(c.has(0)).toBe(true)
    expect(c.has(3)).toBe(true)
  })
})

describe('sudoku generator', () => {
  it('fullGrid produces a complete valid solution', () => {
    expect(isCompleteValid(fullGrid())).toBe(true)
  })

  it('countSolutions reports exactly 1 for a complete grid', () => {
    expect(countSolutions(fullGrid(), 2)).toBe(1)
  })

  for (const [diff, lo, hi] of [['easy', 40, 44], ['medium', 32, 36], ['hard', 26, 30]]) {
    it(`generate('${diff}') yields a unique-solution puzzle matching its solution`, () => {
      const { puzzle, solution, givens } = generate(diff)
      // Solution is a real solved grid.
      expect(isCompleteValid(solution)).toBe(true)
      // Givens line up with the solution; blanks are 0.
      for (let i = 0; i < 81; i++) {
        if (puzzle[i] !== 0) expect(puzzle[i]).toBe(solution[i])
        expect(givens[i]).toBe(puzzle[i] !== 0)
      }
      // Unique solution — the whole point of the generator.
      expect(countSolutions(puzzle, 2)).toBe(1)
      // Givens count lands near target (symmetric digging can stop a touch early).
      const count = puzzle.filter(v => v !== 0).length
      expect(count).toBeGreaterThanOrEqual(lo)
      expect(count).toBeLessThanOrEqual(hi + 6)
    })
  }
})
