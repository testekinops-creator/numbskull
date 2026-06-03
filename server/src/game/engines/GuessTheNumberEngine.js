import { computeOptimalMoves } from '../utils/optimal.js'

const RANGES = { 100: 100, 500: 500, 1000: 1000 }
const DEFAULT_RANGE = 100

export class GuessTheNumberEngine {
  constructor({ difficulty = 'medium', range } = {}) {
    this.difficulty = difficulty
    this.range = RANGES[range] || DEFAULT_RANGE
    this.secret = this._pickSecret()
    this.guesses = []
    this.over = false
    this.won = false
    this.optimalMoves = computeOptimalMoves(this.range)
  }

  evaluate(rawGuess) {
    if (this.over) return this._endState()

    const guess = parseInt(rawGuess, 10)

    if (!Number.isInteger(guess) || guess < 1 || guess > this.range) {
      return { valid: false, error: `Guess must be a number between 1 and ${this.range}` }
    }

    this.guesses.push(guess)
    const proximity = this._proximity(guess)

    if (guess === this.secret) {
      this.over = true
      this.won = true
      return {
        valid: true, correct: true, over: true, won: true,
        guess, proximity: 1,
        attempts: this.guesses.length,
        optimalMoves: this.optimalMoves,
        secret: this.secret,
      }
    }

    const direction = guess < this.secret ? 'higher' : 'lower'
    return {
      valid: true, correct: false, over: false, won: false,
      guess, direction, proximity,
      attempts: this.guesses.length,
    }
  }

  _pickSecret() {
    return Math.floor(Math.random() * this.range) + 1
  }

  _proximity(guess) {
    const dist = Math.abs(guess - this.secret)
    return Math.max(0, 1 - dist / this.range)
  }

  _endState() {
    return { valid: false, over: true, won: this.won, error: 'Game is already over' }
  }

  getState() {
    return {
      over: this.over, won: this.won,
      attempts: this.guesses.length,
      guesses: [...this.guesses],
    }
  }
}
