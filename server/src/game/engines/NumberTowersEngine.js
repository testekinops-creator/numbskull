const TOWER_SIZE = 5
const DRAW_SIZE  = 3

export class NumberTowersEngine {
  constructor() {
    this.range   = null
    this.mode    = 'NUMBER_TOWERS'
    this.tower   = Array(TOWER_SIZE).fill(null)
    this.current = this._drawCard()
    this.deck    = []
    this.placed  = 0
    this.over    = false
    this.won     = false
    this.score   = 0
    this._totalDrawn = 1
  }

  place(slot) {
    if (this.over) return { valid: false, error: 'Game is over' }
    if (slot < 0 || slot >= TOWER_SIZE) return { valid: false, error: `Slot must be 0–${TOWER_SIZE - 1}` }
    if (this.tower[slot] !== null) return { valid: false, error: 'Slot already occupied' }
    if (!this._isValidPlacement(slot, this.current)) {
      return { valid: false, error: 'Placement violates ascending order constraint' }
    }

    this.tower[slot] = this.current
    this.placed++

    if (this.placed === TOWER_SIZE) {
      this.over = true
      this.won  = this._isSorted()
      this.score = this._calcScore()
      return { valid: true, over: true, won: this.won, tower: [...this.tower], score: this.score }
    }

    this.current = this._drawCard()
    this._totalDrawn++

    return {
      valid: true, over: false, placed: this.placed,
      tower: [...this.tower], next: this.current,
      slot, score: null,
    }
  }

  discard() {
    if (this.over) return { valid: false, error: 'Game is over' }
    if (this._totalDrawn > TOWER_SIZE + DRAW_SIZE) {
      return { valid: false, error: 'No discards remaining' }
    }
    const discarded = this.current
    this.current = this._drawCard()
    this._totalDrawn++
    return { valid: true, discarded, next: this.current }
  }

  _isValidPlacement(slot, value) {
    const left  = slot > 0 ? this.tower[slot - 1] : null
    const right = slot < TOWER_SIZE - 1 ? this.tower[slot + 1] : null
    if (left  !== null && value <= left)  return false
    if (right !== null && value >= right) return false
    return true
  }

  _isSorted() {
    for (let i = 1; i < this.tower.length; i++) {
      if (this.tower[i] <= this.tower[i - 1]) return false
    }
    return true
  }

  _calcScore() {
    if (!this.won) return 0
    return Math.max(0, 1000 - (this._totalDrawn - TOWER_SIZE) * 100)
  }

  _drawCard() {
    return Math.floor(Math.random() * 99) + 1
  }

  getState() {
    return {
      tower: [...this.tower], current: this.current,
      placed: this.placed, discardLeft: Math.max(0, DRAW_SIZE - (this._totalDrawn - this.placed)),
      over: this.over, won: this.won, score: this.score,
    }
  }
}
