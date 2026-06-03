export class BullsCowsEngine {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    this.secret = this._pickSecret()
    this.guesses = []
    this.over = false
    this.won = false
    this.maxGuesses = 10
    this.range = null
  }

  evaluate(rawGuess) {
    if (this.over) return this._endState()

    const guess = String(rawGuess).trim()

    if (!/^\d{4}$/.test(guess)) {
      return { valid: false, error: 'Guess must be exactly 4 digits (0-9)' }
    }
    if (new Set(guess).size !== 4) {
      return { valid: false, error: 'Digits must all be different' }
    }

    const { bulls, cows, positions } = this._score(guess, this.secret)
    this.guesses.push({ guess, bulls, cows, positions })

    if (bulls === 4) {
      this.over = true
      this.won = true
      return {
        valid: true, correct: true, over: true, won: true,
        guess, bulls, cows, positions,
        attempts: this.guesses.length,
        secret: this.secret,
      }
    }

    if (this.guesses.length >= this.maxGuesses) {
      this.over = true
      return {
        valid: true, correct: false, over: true, won: false,
        guess, bulls, cows, positions,
        attempts: this.guesses.length,
        secret: this.secret,
      }
    }

    return {
      valid: true, correct: false, over: false, won: false,
      guess, bulls, cows, positions,
      attempts: this.guesses.length,
      remaining: this.maxGuesses - this.guesses.length,
    }
  }

  static score(guess, secret) {
    return new BullsCowsEngine()._score(String(guess), String(secret))
  }

  _score(guess, secret) {
    let bulls = 0
    let cows  = 0
    // positions[i] = 'bull' | 'cow' | 'miss'
    const positions = Array(4).fill('miss')

    for (let i = 0; i < 4; i++) {
      if (guess[i] === secret[i]) {
        bulls++
        positions[i] = 'bull'
      } else if (secret.includes(guess[i])) {
        cows++
        positions[i] = 'cow'
      }
    }
    return { bulls, cows, positions }
  }

  _pickSecret() {
    const digits = Array.from({ length: 10 }, (_, i) => String(i))
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]]
    }
    return digits.slice(0, 4).join('')
  }

  _endState() {
    return { valid: false, over: true, won: this.won, error: 'Game is already over' }
  }

  getState() {
    return {
      over: this.over, won: this.won,
      attempts: this.guesses.length,
      guesses: this.guesses.map(g => ({ ...g })),
    }
  }
}
