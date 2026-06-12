// Sudoku — multiplayer-only collaborative mode. The engine owns puzzle
// generation and answer validation; the multiplayer handler (matchHandlers.js)
// owns the shared grid state, scoring, and cell-ownership rules. The solution
// is held server-side and never sent to clients.
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

// Number of pre-filled clues per difficulty (more clues = easier).
const GIVENS = { easy: 42, medium: 34, hard: 28 }

export class SudokuEngine {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    const { puzzle, solution } = SudokuEngine.generate(difficulty)
    this.puzzle   = puzzle    // givens (0 = blank) — safe to send to clients
    this.solution = solution  // SERVER ONLY
    this.range    = null
  }

  static generate(difficulty = 'medium') {
    const solution = SudokuEngine._fullGrid()
    const givens   = GIVENS[difficulty] ?? GIVENS.medium
    const puzzle   = SudokuEngine._removeCells(solution, 81 - givens)
    return { puzzle, solution }
  }

  // A complete, valid grid via randomized backtracking.
  static _fullGrid() {
    const grid = Array(81).fill(0)
    SudokuEngine._solve(grid)
    return grid
  }

  static _solve(grid) {
    const idx = grid.indexOf(0)
    if (idx === -1) return true
    const row = Math.floor(idx / 9), col = idx % 9
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (SudokuEngine._valid(grid, row, col, v)) {
        grid[idx] = v
        if (SudokuEngine._solve(grid)) return true
        grid[idx] = 0
      }
    }
    return false
  }

  static _valid(grid, row, col, v) {
    for (let i = 0; i < 9; i++) {
      if (grid[row * 9 + i] === v) return false   // row
      if (grid[i * 9 + col] === v) return false   // column
    }
    const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[(br + r) * 9 + (bc + c)] === v) return false  // 3×3 box
      }
    }
    return true
  }

  static _removeCells(solution, count) {
    const puzzle = [...solution]
    const order = shuffled([...Array(81).keys()])
    let removed = 0
    for (const idx of order) {
      if (removed >= count) break
      puzzle[idx] = 0
      removed++
    }
    return puzzle
  }

  isCorrect(index, value) { return this.solution[index] === Number(value) }
  cellSolution(index)     { return this.solution[index] }
}

// Points awarded for a correct fill, given the player's NEW combo length (the
// streak of consecutive correct cells including this one). A hot streak
// accelerates scoring, which makes the multiplayer race swingy and exciting:
//   combo 1 → +1, combo 2 → +2, combo 3–4 → +3, combo 5+ → +4.
export function sudokuComboGain(combo) {
  const bonus = combo >= 5 ? 3 : combo >= 3 ? 2 : combo >= 2 ? 1 : 0
  return 1 + bonus
}
