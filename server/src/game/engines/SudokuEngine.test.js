import { describe, it, expect } from 'vitest'
import { SudokuEngine } from './SudokuEngine.js'

function validUnit(values) {
  // values: array of 9 numbers 1..9 → must be a permutation
  return new Set(values).size === 9 && values.every(v => v >= 1 && v <= 9)
}

function solutionIsValid(sol) {
  for (let r = 0; r < 9; r++) {
    const row = [], col = [], box = []
    for (let c = 0; c < 9; c++) {
      row.push(sol[r * 9 + c])
      col.push(sol[c * 9 + r])
      const br = Math.floor(r / 3) * 3 + Math.floor(c / 3)
      const bc = (r % 3) * 3 + (c % 3)
      box.push(sol[br * 9 * 3 + 0]) // placeholder, recompute below
    }
    if (!validUnit(row) || !validUnit(col)) return false
  }
  // boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box = []
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box.push(sol[(br * 3 + r) * 9 + (bc * 3 + c)])
      if (!validUnit(box)) return false
    }
  }
  return true
}

describe('SudokuEngine', () => {
  it('generates a complete, valid 81-cell solution', () => {
    const e = new SudokuEngine({ difficulty: 'medium' })
    expect(e.solution.length).toBe(81)
    expect(e.solution.every(v => v >= 1 && v <= 9)).toBe(true)
    expect(solutionIsValid(e.solution)).toBe(true)
  })

  it('puzzle matches the solution on every given cell', () => {
    const e = new SudokuEngine({ difficulty: 'easy' })
    e.puzzle.forEach((v, i) => {
      if (v !== 0) expect(v).toBe(e.solution[i])
    })
  })

  it('difficulty controls the number of givens (easy > medium > hard)', () => {
    const givens = d => new SudokuEngine({ difficulty: d }).puzzle.filter(v => v !== 0).length
    const easy = givens('easy'), medium = givens('medium'), hard = givens('hard')
    expect(easy).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(hard)
    expect(hard).toBeGreaterThanOrEqual(17) // a sudoku needs >=17 clues to be sane
  })

  it('isCorrect validates against the solution', () => {
    const e = new SudokuEngine()
    const blank = e.puzzle.indexOf(0)
    const right = e.solution[blank]
    const wrong = right === 9 ? 1 : right + 1
    expect(e.isCorrect(blank, right)).toBe(true)
    expect(e.isCorrect(blank, wrong)).toBe(false)
  })

  it('isCorrect coerces string values (socket payloads)', () => {
    const e = new SudokuEngine()
    const blank = e.puzzle.indexOf(0)
    expect(e.isCorrect(blank, String(e.solution[blank]))).toBe(true)
  })

  it('every blank in the puzzle has a known solution value', () => {
    const e = new SudokuEngine({ difficulty: 'hard' })
    e.puzzle.forEach((v, i) => {
      if (v === 0) expect(e.cellSolution(i)).toBeGreaterThanOrEqual(1)
    })
  })
})
