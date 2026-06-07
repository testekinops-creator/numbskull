// Spin Battle — a Wheel-of-Fortune-style word game (solo, Phase 1).
// Spin the wheel; a points wedge lets you call a consonant (points = wedge ×
// occurrences). Buy vowels for a fixed cost. Solve any time. Bankrupt wipes your
// bank; too many wrong guesses ends the run. ALL randomness + the answer live on
// the server (never trust the client) — the client only animates to the index we
// return. Stored as plain data so a room could serialize it later (Phase 2).

import { SPIN_PUZZLES } from '../data/spinPuzzles.js'

// 8-segment wheel. Index order is intentionally mixed for a nicer-looking wheel.
export const WHEEL = [200, 'BANKRUPT', 600, 'LOSE_TURN', 400, 1000, 'EXTRA_TURN', 800]

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])
const VOWEL_COST = 250
const MAX_STRIKES = 5
const EXTRA_TURN_BONUS = 200

function rnd(n) { return Math.floor(Math.random() * n) }
function lettersOnly(t) { return t.replace(/[^A-Z]/g, '') }

function pickPuzzle(difficulty) {
  const fits = (t) => {
    const n = lettersOnly(t).length
    if (difficulty === 'easy') return n <= 11
    if (difficulty === 'hard') return n >= 18
    return n >= 12 && n <= 17
  }
  let pool = SPIN_PUZZLES.filter(p => fits(p.text.toUpperCase()))
  if (!pool.length) pool = SPIN_PUZZLES
  return pool[rnd(pool.length)]
}

export class SpinBattleEngine {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    const picked = pickPuzzle(difficulty)
    this.answer = picked.text.toUpperCase()
    this.category = picked.category
    this.revealed = new Set()       // uppercase letters revealed so far
    this.bank = 0
    this.strikes = 0
    this.maxStrikes = MAX_STRIKES
    this.canGuess = false           // a live points-wedge is waiting for a consonant
    this.lastWedge = null
    this.over = false
    this.won = false
    this.range = null               // parity with other engines (start returns engine.range)
  }

  get wheel() { return [...WHEEL] }

  _puzzleLetters() { return new Set(lettersOnly(this.answer).split('')) }

  _allRevealed() {
    for (const ch of this._puzzleLetters()) if (!this.revealed.has(ch)) return false
    return true
  }

  _countOf(letter) {
    let n = 0
    for (const ch of this.answer) if (ch === letter) n++
    return n
  }

  masked() {
    return this.answer.split('').map(ch => {
      if (ch === ' ') return ' '
      if (!/[A-Z]/.test(ch)) return ch
      return this.revealed.has(ch) ? ch : '_'
    }).join('')
  }

  publicState() {
    const state = {
      masked: this.masked(),
      category: this.category,
      bank: this.bank,
      strikes: this.strikes,
      maxStrikes: this.maxStrikes,
      canGuess: this.canGuess,
      lastWedge: this.lastWedge,
      wheel: this.wheel,
      vowelCost: VOWEL_COST,
      revealed: [...this.revealed],
      over: this.over,
      won: this.won,
    }
    if (this.over) state.answer = this.answer
    return state
  }

  getState() { return this.publicState() }

  // Spin: only allowed when there's no pending consonant to call.
  spin() {
    if (this.over) return { error: 'Game over', ...this.publicState() }
    if (this.canGuess) return { error: 'Call a consonant or solve first', ...this.publicState() }

    const index = rnd(WHEEL.length)
    const wedge = WHEEL[index]
    let effect

    if (typeof wedge === 'number') {
      this.lastWedge = wedge
      this.canGuess = true
      effect = 'points'
    } else if (wedge === 'BANKRUPT') {
      this.bank = 0
      this.lastWedge = null
      effect = 'bankrupt'
    } else if (wedge === 'LOSE_TURN') {
      this.lastWedge = null
      effect = 'lose_turn'      // solo: nothing lost but the spin — go again
    } else { // EXTRA_TURN
      this.bank += EXTRA_TURN_BONUS
      this.lastWedge = null
      effect = 'extra_turn'
    }
    return { index, wedge, effect, ...this.publicState() }
  }

  guessConsonant(letter) {
    letter = String(letter || '').toUpperCase()
    if (this.over) return { error: 'Game over', ...this.publicState() }
    if (!/^[A-Z]$/.test(letter) || VOWELS.has(letter)) return { error: 'Pick a consonant', ...this.publicState() }
    if (!this.canGuess || typeof this.lastWedge !== 'number') return { error: 'Spin first', ...this.publicState() }
    if (this.revealed.has(letter)) return { error: 'Already guessed', ...this.publicState() }

    const count = this._countOf(letter)
    this.canGuess = false
    const wedge = this.lastWedge
    this.lastWedge = null
    let correct = false, points = 0

    if (count > 0) {
      this.revealed.add(letter)
      points = wedge * count
      this.bank += points
      correct = true
      if (this._allRevealed()) { this.over = true; this.won = true }
    } else {
      this.strikes++
      if (this.strikes >= this.maxStrikes) { this.over = true; this.won = false }
    }
    return { letter, correct, count, points, ...this.publicState() }
  }

  buyVowel(letter) {
    letter = String(letter || '').toUpperCase()
    if (this.over) return { error: 'Game over', ...this.publicState() }
    if (this.canGuess) return { error: 'Call a consonant or solve first', ...this.publicState() }
    if (!VOWELS.has(letter)) return { error: 'Pick a vowel', ...this.publicState() }
    if (this.revealed.has(letter)) return { error: 'Already revealed', ...this.publicState() }
    if (this.bank < VOWEL_COST) return { error: 'Not enough points for a vowel', ...this.publicState() }

    this.bank -= VOWEL_COST
    this.lastWedge = null
    const count = this._countOf(letter)
    let correct = false
    if (count > 0) {
      this.revealed.add(letter)
      correct = true
      if (this._allRevealed()) { this.over = true; this.won = true }
    }
    return { letter, vowel: true, correct, count, ...this.publicState() }
  }

  solve(attempt) {
    if (this.over) return { error: 'Game over', ...this.publicState() }
    const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim()
    const correct = norm(attempt) === norm(this.answer)

    if (correct) {
      for (const ch of this._puzzleLetters()) this.revealed.add(ch)
      this.over = true; this.won = true
      this.canGuess = false; this.lastWedge = null
      return { solved: true, ...this.publicState() }
    }
    this.strikes++
    if (this.strikes >= this.maxStrikes) { this.over = true; this.won = false }
    return { solved: false, ...this.publicState() }
  }
}
