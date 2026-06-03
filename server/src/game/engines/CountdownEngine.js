const SMALL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]
const LARGE = [25, 50, 75, 100]
const TIME_LIMIT_MS = 60_000

export class CountdownEngine {
  constructor({ largeCount = 1 } = {}) {
    this.range     = null
    this.mode      = 'COUNTDOWN'
    this.target    = this._pickTarget()
    this.numbers   = this._pickNumbers(largeCount)
    this.over      = false
    this.won       = false
    this.bestScore = null
    this.bestExpr  = null
    this.startedAt = Date.now()
    this.timeLimitMs = TIME_LIMIT_MS
  }

  submit(expression) {
    if (this.over) return { valid: false, error: 'Round is over' }

    const elapsed = Date.now() - this.startedAt
    if (elapsed > this.timeLimitMs) {
      this.over = true
      return this._timeupResult()
    }

    const result = this._evaluate(expression)
    if (!result.valid) return result

    const diff = Math.abs(result.value - this.target)
    if (this.bestScore === null || diff < Math.abs(this.bestScore - this.target)) {
      this.bestScore = result.value
      this.bestExpr  = expression
    }

    if (diff === 0) {
      this.over = true
      this.won  = true
      return { valid: true, correct: true, over: true, won: true, value: result.value, target: this.target, diff: 0, expression }
    }

    return { valid: true, correct: false, over: false, value: result.value, target: this.target, diff, expression }
  }

  timeUp() {
    this.over = true
    return this._timeupResult()
  }

  _timeupResult() {
    const diff = this.bestScore !== null ? Math.abs(this.bestScore - this.target) : null
    const won  = diff === 0
    return {
      valid: true, over: true, won,
      bestScore: this.bestScore, bestExpr: this.bestExpr,
      target: this.target, numbers: this.numbers, diff,
    }
  }

  _pickTarget() {
    return Math.floor(Math.random() * 899) + 101
  }

  _pickNumbers(largeCount = 1) {
    const large = _shuffle([...LARGE]).slice(0, Math.min(largeCount, 4))
    const small = _shuffle([...SMALL]).slice(0, 6 - large.length)
    return _shuffle([...large, ...small])
  }

  _evaluate(expr) {
    const allowed = this.numbers.slice()
    const used = []

    const clean = String(expr).replace(/\s+/g, '')
    if (!/^[\d\+\-\*\/\(\)]+$/.test(clean)) {
      return { valid: false, error: 'Invalid characters in expression' }
    }

    const tokens = clean.match(/\d+/g)?.map(Number) || []
    for (const t of tokens) {
      const idx = allowed.indexOf(t)
      if (idx === -1) return { valid: false, error: `Number ${t} not available or used twice` }
      allowed.splice(idx, 1)
      used.push(t)
    }

    let value
    try {
      value = Function(`"use strict"; return (${clean})`)()
    } catch {
      return { valid: false, error: 'Invalid expression syntax' }
    }

    if (!Number.isInteger(value) || value < 0) {
      return { valid: false, error: 'Expression must evaluate to a positive integer' }
    }

    return { valid: true, value }
  }

  getState() {
    return {
      target: this.target, numbers: this.numbers,
      over: this.over, won: this.won,
      timeRemainingMs: Math.max(0, this.timeLimitMs - (Date.now() - this.startedAt)),
    }
  }
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
