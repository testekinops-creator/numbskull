// Tic-Tac-Toe (XOX) — used for the single-player AI mode (REST) and as the
// shared win/draw logic for the multiplayer socket handler.
//
// Board is a flat array of 9 cells, indexed 0..8:
//   0 | 1 | 2
//   3 | 4 | 5
//   6 | 7 | 8
// Each cell is 'X', 'O', or null. X always moves first.

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
]

export class TicTacToeEngine {
  constructor({ difficulty = 'medium', symbol = 'X' } = {}) {
    this.difficulty   = difficulty
    this.playerSymbol = symbol === 'O' ? 'O' : 'X'
    this.aiSymbol     = this.playerSymbol === 'X' ? 'O' : 'X'
    this.board  = Array(9).fill(null)
    this.turn   = 'X'      // X always starts
    this.over   = false
    this.winner = null     // 'X' | 'O' | null
    this.draw   = false
    this.range  = null     // present for REST /start compatibility (engine.range)
  }

  getState() {
    return {
      board:        [...this.board],
      turn:         this.turn,
      over:         this.over,
      winner:       this.winner,
      draw:         this.draw,
      playerSymbol: this.playerSymbol,
      aiSymbol:     this.aiSymbol,
    }
  }

  // If the AI owns the opening move (player chose O), play it. Used by /start.
  aiOpeningMove() {
    if (!this.over && this.turn === this.aiSymbol) {
      const cell = TicTacToeEngine.bestMove(this.board, this.aiSymbol, this.difficulty)
      if (cell != null) this._apply(cell, this.aiSymbol)
    }
    return this.getState()
  }

  // The human plays `cell`; if the game continues into the AI's turn, the AI
  // immediately responds. Returns the resulting state plus the AI's move.
  playerMove(cell) {
    if (this.over)                    return { valid: false, error: 'Game is over',  ...this.getState() }
    if (this.turn !== this.playerSymbol) return { valid: false, error: 'Not your turn', ...this.getState() }

    const applied = this._apply(cell, this.playerSymbol)
    if (!applied.valid) return { valid: false, error: applied.error, ...this.getState() }

    let aiMove = null
    if (!this.over && this.turn === this.aiSymbol) {
      aiMove = TicTacToeEngine.bestMove(this.board, this.aiSymbol, this.difficulty)
      if (aiMove != null) this._apply(aiMove, this.aiSymbol)
    }

    return { valid: true, aiMove, ...this.getState() }
  }

  _apply(cell, symbol) {
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { valid: false, error: 'Invalid cell' }
    if (this.board[cell] !== null)                       return { valid: false, error: 'Cell occupied' }

    this.board[cell] = symbol
    const w = TicTacToeEngine.winnerOf(this.board)
    if (w) {
      this.over = true
      this.winner = w
    } else if (this.board.every(c => c !== null)) {
      this.over = true
      this.draw = true
    } else {
      this.turn = symbol === 'X' ? 'O' : 'X'
    }
    return { valid: true }
  }

  // ── Static helpers (also used by the multiplayer handler) ─────────────────
  static winnerOf(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
    }
    return null
  }

  static isDraw(board) {
    return !TicTacToeEngine.winnerOf(board) && board.every(c => c !== null)
  }

  // Pick a move for `aiSymbol`. Difficulty scales how often it plays optimally:
  //   easy   → random
  //   medium → 70% optimal, 30% random (beatable but not trivial)
  //   hard   → always optimal (unbeatable minimax)
  static bestMove(board, aiSymbol, difficulty = 'hard') {
    const empties = board.map((v, i) => (v === null ? i : null)).filter(i => i !== null)
    if (empties.length === 0) return null

    if (difficulty === 'easy') {
      return empties[Math.floor(Math.random() * empties.length)]
    }
    if (difficulty === 'medium' && Math.random() < 0.3) {
      return empties[Math.floor(Math.random() * empties.length)]
    }
    return TicTacToeEngine._minimaxMove(board, aiSymbol)
  }

  static _minimaxMove(board, aiSymbol) {
    const human = aiSymbol === 'X' ? 'O' : 'X'
    let bestScore = -Infinity
    let move = null
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol
        const score = TicTacToeEngine._minimax(board, 0, false, aiSymbol, human)
        board[i] = null
        if (score > bestScore) { bestScore = score; move = i }
      }
    }
    return move
  }

  static _minimax(board, depth, isMax, aiSymbol, human) {
    const w = TicTacToeEngine.winnerOf(board)
    if (w === aiSymbol) return 10 - depth
    if (w === human)    return depth - 10
    if (board.every(c => c !== null)) return 0

    if (isMax) {
      let best = -Infinity
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = aiSymbol
          best = Math.max(best, TicTacToeEngine._minimax(board, depth + 1, false, aiSymbol, human))
          board[i] = null
        }
      }
      return best
    }
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = human
        best = Math.min(best, TicTacToeEngine._minimax(board, depth + 1, true, aiSymbol, human))
        board[i] = null
      }
    }
    return best
  }
}
