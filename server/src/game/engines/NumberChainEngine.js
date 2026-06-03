const OPS = ['+', '-', '*', '/']

export class NumberChainEngine {
  constructor({ startValue, target, maxMoves = 10 } = {}) {
    this.range    = null
    this.mode     = 'NUMBER_CHAIN'
    this.start    = startValue ?? Math.floor(Math.random() * 20) + 1
    this.target   = target    ?? Math.floor(Math.random() * 90) + 10
    this.current  = this.start
    this.moves    = []
    this.maxMoves = maxMoves
    this.over     = false
    this.won      = false
  }

  applyMove(op, operand) {
    if (this.over) return { valid: false, error: 'Game is over' }

    if (!OPS.includes(op)) {
      return { valid: false, error: `Invalid operator. Use one of: ${OPS.join(' ')}` }
    }

    const n = Number(operand)
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      return { valid: false, error: 'Operand must be an integer between 1 and 100' }
    }

    let next
    switch (op) {
      case '+': next = this.current + n; break
      case '-': next = this.current - n; break
      case '*': next = this.current * n; break
      case '/':
        if (this.current % n !== 0) return { valid: false, error: 'Division must produce a whole number' }
        next = this.current / n
        break
    }

    this.moves.push({ op, operand: n, before: this.current, after: next })
    this.current = next

    const reached = this.current === this.target
    if (reached || this.moves.length >= this.maxMoves) {
      this.over = true
      this.won  = reached
    }

    return {
      valid: true, op, operand: n,
      before: this.moves.at(-1).before,
      after: next,
      target: this.target,
      reached,
      over: this.over,
      won: this.won,
      movesLeft: this.maxMoves - this.moves.length,
    }
  }

  getState() {
    return {
      start: this.start, target: this.target, current: this.current,
      moves: this.moves, maxMoves: this.maxMoves,
      movesLeft: this.maxMoves - this.moves.length,
      over: this.over, won: this.won,
    }
  }
}
