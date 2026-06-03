export class GTNAi {
  constructor({ difficulty = 'medium', range = 100 } = {}) {
    this.difficulty = difficulty
    this.range = range
    this.low = 1
    this.high = range
    this.history = []
  }

  nextGuess() {
    if (this.difficulty === 'easy') {
      return this._randomGuess()
    }
    if (this.difficulty === 'medium') {
      return Math.random() < 0.6 ? this._binaryGuess() : this._randomGuess()
    }
    return this._binaryGuess()
  }

  applyFeedback(guess, direction) {
    this.history.push({ guess, direction })
    if (direction === 'higher') {
      this.low = Math.max(this.low, guess + 1)
    } else if (direction === 'lower') {
      this.high = Math.min(this.high, guess - 1)
    }
  }

  _binaryGuess() {
    return Math.floor((this.low + this.high) / 2)
  }

  _randomGuess() {
    return Math.floor(Math.random() * (this.high - this.low + 1)) + this.low
  }

  reset() {
    this.low = 1
    this.high = this.range
    this.history = []
  }
}
