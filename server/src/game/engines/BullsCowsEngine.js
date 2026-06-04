// Bulls & Cows — 6 digits, DUPLICATES ALLOWED.
// Scoring uses the standard Mastermind-with-duplicates algorithm:
//   bulls = digits in the exact right position
//   cows  = additional digit matches (right digit, wrong position),
//           counted via min frequency of each digit across the non-bull slots
const CODE_LENGTH = 6

export class BullsCowsEngine {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    this.length = CODE_LENGTH
    this.secret = this._pickSecret()
    this.guesses = []
    this.over = false
    this.won = false
    this.maxGuesses = 12
    this.range = null
  }

  evaluate(rawGuess) {
    if (this.over) return this._endState()

    const guess = String(rawGuess).trim()

    // 6 digits, duplicates allowed → only a length/charset check
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(guess)) {
      return { valid: false, error: `Guess must be exactly ${CODE_LENGTH} digits (0-9)` }
    }

    const { bulls, cows, positions } = this._score(guess, this.secret)
    this.guesses.push({ guess, bulls, cows, positions })

    if (bulls === CODE_LENGTH) {
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
    const n = secret.length
    let bulls = 0
    // positions[i] = 'bull' | 'miss' (cows are NOT revealed per-position)
    const positions = Array(n).fill('miss')

    // Frequency maps of the NON-bull positions
    const secretFreq = {}
    const guessFreq  = {}

    for (let i = 0; i < n; i++) {
      if (guess[i] === secret[i]) {
        bulls++
        positions[i] = 'bull'
      } else {
        secretFreq[secret[i]] = (secretFreq[secret[i]] || 0) + 1
        guessFreq[guess[i]]   = (guessFreq[guess[i]]   || 0) + 1
      }
    }

    // cows = sum over each digit of min(times in guess, times in secret)
    let cows = 0
    for (const d in guessFreq) {
      if (secretFreq[d]) cows += Math.min(guessFreq[d], secretFreq[d])
    }

    return { bulls, cows, positions }
  }

  _pickSecret() {
    // 6 random digits 0-9, duplicates allowed
    let s = ''
    for (let i = 0; i < CODE_LENGTH; i++) s += Math.floor(Math.random() * 10)
    return s
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
