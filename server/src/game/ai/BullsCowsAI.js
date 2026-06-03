import { BullsCowsEngine } from '../engines/BullsCowsEngine.js'

function allCodes() {
  const codes = []
  for (let a = 0; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++)
        for (let d = 0; d <= 9; d++) {
          const s = `${a}${b}${c}${d}`
          if (new Set(s).size === 4) codes.push(s)
        }
  return codes
}

export class BullsCowsAI {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    this.possible = allCodes()
    this.firstGuess = '0123'
    this.history = []
    this._tried = new Set()
  }

  nextGuess() {
    if (this.possible.length === 0) return null

    if (this.difficulty === 'easy') {
      const idx = Math.floor(Math.random() * this.possible.length)
      return this.possible[idx]
    }

    if (this.history.length === 0) return this.firstGuess

    if (this.difficulty === 'medium' && this.possible.length > 20) {
      const idx = Math.floor(Math.random() * this.possible.length)
      return this.possible[idx]
    }

    return this._knuthGuess()
  }

  applyFeedback(guess, bulls, cows) {
    this.history.push({ guess, bulls, cows })
    this._tried.add(guess)
    this.possible = this.possible.filter((candidate) => {
      const { bulls: b, cows: c } = BullsCowsEngine.score(guess, candidate)
      return b === bulls && c === cows
    })
  }

  _knuthGuess() {
    if (this.possible.length <= 2) return this.possible[0]

    let bestGuess = null
    let bestWorstCase = Infinity
    const candidates = allCodes()

    for (const candidate of candidates) {
      if (this._tried.has(candidate)) continue
      const partitionSizes = {}
      for (const p of this.possible) {
        const { bulls, cows } = BullsCowsEngine.score(candidate, p)
        const key = `${bulls},${cows}`
        partitionSizes[key] = (partitionSizes[key] || 0) + 1
      }
      const worstCase = Math.max(...Object.values(partitionSizes))
      const isPossible = this.possible.includes(candidate)
      if (
        worstCase < bestWorstCase ||
        (worstCase === bestWorstCase && isPossible && !bestGuess?.isPossible)
      ) {
        bestWorstCase = worstCase
        bestGuess = { guess: candidate, isPossible }
      }
    }

    return bestGuess?.guess || this.possible[0]
  }

  reset() {
    this.possible = allCodes()
    this.history = []
    this._tried = new Set()
  }
}
