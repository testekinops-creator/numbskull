import { GuessTheNumberEngine } from './GuessTheNumberEngine.js'

export class ReverseChallenge {
  constructor({ challengerId, challengerSecret, range = 100 } = {}) {
    this.range          = range
    this.mode           = 'REVERSE'
    this.challengerId   = challengerId
    this.secret         = challengerSecret || String(Math.floor(Math.random() * range) + 1)
    this.engine         = new GuessTheNumberEngine({ range })
    this.engine.secret  = parseInt(this.secret, 10)
    this.over           = false
    this.won            = false
  }

  guess(value) {
    const result = this.engine.evaluate(value)
    if (result.correct || result.over) {
      this.over = true
      this.won  = !!result.correct
    }
    return result
  }

  getHint() {
    const s = parseInt(this.secret, 10)
    if (s <= this.range * 0.33) return 'low'
    if (s <= this.range * 0.66) return 'mid'
    return 'high'
  }

  getState() {
    return { ...this.engine.getState(), range: this.range, hint: this.getHint() }
  }
}
