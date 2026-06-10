// SOS — a 2-player grid game. Board is a flat size*size array of 'S' | 'O' | null.
// Players take turns placing an S or O; completing an S–O–S triple (any of the 8
// directions) scores a point and grants a bonus turn. The game ends when the
// board is full; the higher score wins (a tie is a draw).
//
// The static helpers (linesAt, isFull, bestMove) are shared by the multiplayer
// socket handler; the class below drives the single-player REST-vs-AI flow.

const DIRS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],     // vertical, horizontal
  [-1, -1], [1, 1], [-1, 1], [1, -1],   // diagonals
]
// The 4 distinct axes (a direction + its opposite) for the "O is the middle" check.
const AXES = [[-1, 0], [0, -1], [-1, -1], [-1, 1]]

export class SosEngine {
  constructor({ boardSize = 8, difficulty = 'medium' } = {}) {
    this.size       = Number(boardSize) === 10 ? 10 : 8
    this.difficulty = difficulty
    this.board      = Array(this.size * this.size).fill(null)
    this.scores     = { player: 0, ai: 0 }
    this.turn       = 'player'   // 'player' | 'ai' — the human always starts
    this.over       = false
    this.winner     = null       // 'player' | 'ai' | null (null + over = draw)
    this.lines      = []         // [{ cells: [i,i,i], by: 'player' | 'ai' }]
    this.range      = null       // REST /start compatibility (engine.range)
  }

  getState() {
    return {
      size:   this.size,
      board:  [...this.board],
      scores: { ...this.scores },
      turn:   this.turn,
      over:   this.over,
      winner: this.winner,
      draw:   this.over && this.winner === null,
      lines:  this.lines.map(l => ({ by: l.by, cells: [...l.cells] })),
    }
  }

  // The human places `letter` at `cell`. Any S–O–S formed scores immediately
  // (the client's "draw to continue" gate guarantees they're drawn). Forming
  // ≥1 keeps the human's turn (bonus); otherwise the AI plays out its full turn.
  playerMove(cell, letter) {
    if (this.over)               return { valid: false, error: 'Game over',    ...this.getState() }
    if (this.turn !== 'player')  return { valid: false, error: 'Not your turn', ...this.getState() }
    letter = String(letter || '').toUpperCase()
    if (letter !== 'S' && letter !== 'O') return { valid: false, error: 'Pick S or O', ...this.getState() }
    if (!this._validEmpty(cell)) return { valid: false, error: 'Cell occupied', ...this.getState() }

    const formed = this._place(cell, letter, 'player')
    let aiMoves = []
    if (!this.over && formed.length === 0) {
      this.turn = 'ai'
      aiMoves = this._runAi()
    }
    return { valid: true, formed, aiMoves, ...this.getState() }
  }

  _validEmpty(cell) {
    return Number.isInteger(cell) && cell >= 0 && cell < this.board.length && this.board[cell] === null
  }

  // Place a letter, record + score any SOS formed, settle game-over. Returns the
  // formed lines (array of sorted cell-index triples).
  _place(cell, letter, by) {
    this.board[cell] = letter
    const formed = SosEngine.linesAt(this.board, this.size, cell)
    for (const cells of formed) {
      this.lines.push({ cells, by })
      this.scores[by] += 1
    }
    // Combo: a single move completing 2+ S–O–S earns a bonus (DOUBLE = +1, TRIPLE = +2…).
    if (formed.length >= 2) this.scores[by] += formed.length - 1
    if (SosEngine.isFull(this.board)) {
      this.over = true
      this.winner = this.scores.player === this.scores.ai
        ? null
        : (this.scores.player > this.scores.ai ? 'player' : 'ai')
    }
    return formed
  }

  // The AI plays its whole turn: it keeps placing while each placement scores
  // (bonus turn), stopping at the first placement that scores nothing.
  _runAi() {
    const moves = []
    while (!this.over && this.turn === 'ai') {
      const mv = SosEngine.bestMove(this.board, this.size, this.difficulty)
      if (!mv) break
      const formed = this._place(mv.cell, mv.letter, 'ai')
      moves.push({ cell: mv.cell, letter: mv.letter, lines: formed })
      if (formed.length === 0) { this.turn = 'player'; break }
    }
    return moves
  }

  // ── Static helpers (also used by the multiplayer handler) ──────────────────
  static rc(idx, size)        { return [Math.floor(idx / size), idx % size] }
  static idx(r, c, size)      { return r * size + c }
  static inBounds(r, c, size) { return r >= 0 && r < size && c >= 0 && c < size }

  // S–O–S triples *completed by the letter just placed at `idx`*. Scans only
  // outward from that cell so previously-formed SOS are never recounted. Each
  // result is a sorted [a,b,c] index triple; duplicates are removed.
  static linesAt(board, size, idx) {
    const letter = board[idx]
    if (letter !== 'S' && letter !== 'O') return []
    const [r, c] = SosEngine.rc(idx, size)
    const out = []
    const add = (a, b, d) => {
      const t = [a, b, d].sort((x, y) => x - y)
      if (!out.some(o => o[0] === t[0] && o[1] === t[1] && o[2] === t[2])) out.push(t)
    }

    if (letter === 'O') {
      // O sits in the middle: S – O – S along each of the 4 axes.
      for (const [dr, dc] of AXES) {
        const r1 = r + dr, c1 = c + dc, r2 = r - dr, c2 = c - dc
        if (SosEngine.inBounds(r1, c1, size) && SosEngine.inBounds(r2, c2, size)) {
          const i1 = SosEngine.idx(r1, c1, size), i2 = SosEngine.idx(r2, c2, size)
          if (board[i1] === 'S' && board[i2] === 'S') add(i1, idx, i2)
        }
      }
    } else {
      // S is an endpoint: S – O – S running outward in each of the 8 directions.
      for (const [dr, dc] of DIRS) {
        const r2 = r + 2 * dr, c2 = c + 2 * dc
        if (SosEngine.inBounds(r2, c2, size)) {
          const i1 = SosEngine.idx(r + dr, c + dc, size), i2 = SosEngine.idx(r2, c2, size)
          if (board[i1] === 'O' && board[i2] === 'S') add(idx, i1, i2)
        }
      }
    }
    return out
  }

  static isFull(board) { return board.every(c => c !== null) }

  // Greedy AI → { cell, letter } | null. Difficulty scales play:
  //   easy   → random empty cell + random letter
  //   medium → the highest-scoring move if any exists, else random
  //   hard   → highest-scoring move; if none, a move that doesn't hand the
  //            opponent an immediate SOS (falling back to random)
  static bestMove(board, size, difficulty = 'medium') {
    const empties = []
    for (let i = 0; i < board.length; i++) if (board[i] === null) empties.push(i)
    if (empties.length === 0) return null
    const rand = () => ({
      cell: empties[Math.floor(Math.random() * empties.length)],
      letter: Math.random() < 0.5 ? 'S' : 'O',
    })
    if (difficulty === 'easy') return rand()

    let best = null, bestScore = 0
    for (const cell of empties) {
      for (const letter of ['S', 'O']) {
        board[cell] = letter
        const n = SosEngine.linesAt(board, size, cell).length
        board[cell] = null
        if (n > bestScore) { bestScore = n; best = { cell, letter } }
      }
    }
    if (best) return best
    if (difficulty !== 'hard') return rand()

    // No scoring move available — avoid moves that let the opponent score next.
    const safe = []
    for (const cell of empties) {
      for (const letter of ['S', 'O']) {
        board[cell] = letter
        const risky = SosEngine._anyImmediateSos(board, size)
        board[cell] = null
        if (!risky) safe.push({ cell, letter })
      }
    }
    return safe.length ? safe[Math.floor(Math.random() * safe.length)] : rand()
  }

  // Could ANY single placement now complete an SOS? (hard AI uses this to avoid
  // setting the opponent up).
  static _anyImmediateSos(board, size) {
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue
      for (const letter of ['S', 'O']) {
        board[i] = letter
        const n = SosEngine.linesAt(board, size, i).length
        board[i] = null
        if (n > 0) return true
      }
    }
    return false
  }
}
