// Spin Battle — a Wheel-of-Fortune-style word game.
// ALL randomness + the answer live on the server; clients only animate to the
// index we return. The pure helpers below (WHEEL, pickPuzzle, maskAnswer, …)
// are shared by BOTH flows: the solo class (REST sessions) and the multiplayer
// match handlers (which keep plain-data state for Redis serialization).

import { SPIN_PUZZLES } from '../data/spinPuzzles.js'

// 13-segment wheel. Index order is intentionally mixed for a nicer-looking
// wheel. Specials: BANKRUPT (wipe bank), LOSE_TURN (pass), EXTRA_TURN (+200),
// DOUBLE (×2 bank), JACKPOT (+1000), STEAL (take from opponent / solo bonus),
// SHIELD (block the next Bankrupt), FREEZE (skip opponent's next turn / solo bonus).
export const WHEEL = [200, 'BANKRUPT', 600, 'STEAL', 400, 'DOUBLE', 1000, 'SHIELD', 800, 'JACKPOT', 'LOSE_TURN', 'FREEZE', 'EXTRA_TURN']

export const VOWEL_COST = 250
export const EXTRA_TURN_BONUS = 200
export const JACKPOT_BONUS = 1000
export const STEAL_AMOUNT = 400
export const FREEZE_SOLO_BONUS = 250
export const MAX_STRIKES = 5

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])
export function isVowel(letter) { return VOWELS.has(String(letter || '').toUpperCase()) }
export function isConsonant(letter) { return /^[A-Z]$/.test(String(letter || '').toUpperCase()) && !isVowel(letter) }

function rnd(n) { return Math.floor(Math.random() * n) }
function lettersOnly(t) { return t.replace(/[^A-Z]/g, '') }

// Recency window — the last N served answers are skipped so a puzzle can't
// repeat within a short period (global across solo + every multiplayer room).
// Kept comfortably below each difficulty pool so there's always a fresh choice.
const RECENT_WINDOW = 12
const _recentAnswers = []

function _rememberAnswer(text) {
  _recentAnswers.push(text)
  while (_recentAnswers.length > RECENT_WINDOW) _recentAnswers.shift()
}

// Test hook: clear the recency window so tests start from a clean slate.
export function _resetPuzzleRecency() { _recentAnswers.length = 0 }

export function pickPuzzle(difficulty = 'medium') {
  const fits = (t) => {
    const n = lettersOnly(t).length
    if (difficulty === 'easy') return n <= 11
    if (difficulty === 'hard') return n >= 18
    return n >= 12 && n <= 17
  }
  let pool = SPIN_PUZZLES.filter(p => fits(p.text.toUpperCase()))
  if (!pool.length) pool = SPIN_PUZZLES
  // Skip recently-served answers; if that empties a small pool, allow repeats so
  // we never fail to return a puzzle.
  const recent = new Set(_recentAnswers)
  let fresh = pool.filter(p => !recent.has(p.text.toUpperCase()))
  if (!fresh.length) fresh = pool
  const p = fresh[rnd(fresh.length)]
  const text = p.text.toUpperCase()
  _rememberAnswer(text)
  return { text, category: p.category }
}

export function spinWheel() {
  const index = rnd(WHEEL.length)
  return { index, wedge: WHEEL[index] }
}

export function countOf(answer, letter) {
  letter = String(letter).toUpperCase()
  let n = 0
  for (const ch of answer) if (ch === letter) n++
  return n
}

export function distinctLetters(answer) {
  return [...new Set(lettersOnly(answer).split(''))]
}

export function isAllRevealed(answer, revealed) {
  const set = revealed instanceof Set ? revealed : new Set(revealed)
  for (const ch of distinctLetters(answer)) if (!set.has(ch)) return false
  return true
}

export function maskAnswer(answer, revealed) {
  const set = revealed instanceof Set ? revealed : new Set(revealed)
  return answer.split('').map(ch => {
    if (ch === ' ') return ' '
    if (!/[A-Z]/.test(ch)) return ch
    return set.has(ch) ? ch : '_'
  }).join('')
}

export function normalizeSolve(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// ── Solo class (REST sessions) ─────────────────────────────────────────────
export class SpinBattleEngine {
  constructor({ difficulty = 'medium' } = {}) {
    this.difficulty = difficulty
    const picked = pickPuzzle(difficulty)
    this.answer = picked.text
    this.category = picked.category
    this.revealed = new Set()       // uppercase letters revealed so far
    this.bank = 0
    this.strikes = 0
    this.maxStrikes = MAX_STRIKES
    this.canGuess = false           // a live points-wedge is waiting for a consonant
    this.lastWedge = null
    this.shield = false             // blocks the next Bankrupt
    this.over = false
    this.won = false
    this.range = null               // parity with other engines (start returns engine.range)
  }

  get wheel() { return [...WHEEL] }

  masked() { return maskAnswer(this.answer, this.revealed) }

  publicState() {
    const state = {
      masked: this.masked(),
      category: this.category,
      bank: this.bank,
      strikes: this.strikes,
      maxStrikes: this.maxStrikes,
      canGuess: this.canGuess,
      lastWedge: this.lastWedge,
      shield: this.shield,
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

  spin() {
    if (this.over) return { error: 'Game over', ...this.publicState() }
    if (this.canGuess) return { error: 'Call a consonant or solve first', ...this.publicState() }

    const { index, wedge } = spinWheel()
    let effect
    this.lastWedge = null

    if (typeof wedge === 'number') {
      this.lastWedge = wedge
      this.canGuess = true
      effect = 'points'
    } else if (wedge === 'BANKRUPT') {
      if (this.shield) { this.shield = false; effect = 'bankrupt_blocked' }
      else { this.bank = 0; effect = 'bankrupt' }
    } else if (wedge === 'LOSE_TURN') {
      effect = 'lose_turn'
    } else if (wedge === 'EXTRA_TURN') {
      this.bank += EXTRA_TURN_BONUS
      effect = 'extra_turn'
    } else if (wedge === 'DOUBLE') {
      this.bank *= 2
      effect = 'double'
    } else if (wedge === 'JACKPOT') {
      this.bank += JACKPOT_BONUS
      effect = 'jackpot'
    } else if (wedge === 'STEAL') { // solo has no opponent → straight bonus
      this.bank += STEAL_AMOUNT
      effect = 'steal'
    } else if (wedge === 'SHIELD') {
      this.shield = true
      effect = 'shield'
    } else { // FREEZE — nobody to freeze in solo → small bonus
      this.bank += FREEZE_SOLO_BONUS
      effect = 'freeze'
    }
    return { index, wedge, effect, ...this.publicState() }
  }

  guessConsonant(letter) {
    letter = String(letter || '').toUpperCase()
    if (this.over) return { error: 'Game over', ...this.publicState() }
    if (!isConsonant(letter)) return { error: 'Pick a consonant', ...this.publicState() }
    if (!this.canGuess || typeof this.lastWedge !== 'number') return { error: 'Spin first', ...this.publicState() }
    if (this.revealed.has(letter)) return { error: 'Already guessed', ...this.publicState() }

    const count = countOf(this.answer, letter)
    this.canGuess = false
    const wedge = this.lastWedge
    this.lastWedge = null
    let correct = false, points = 0

    if (count > 0) {
      this.revealed.add(letter)
      points = wedge * count
      this.bank += points
      correct = true
      if (isAllRevealed(this.answer, this.revealed)) { this.over = true; this.won = true }
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
    if (!isVowel(letter)) return { error: 'Pick a vowel', ...this.publicState() }
    if (this.revealed.has(letter)) return { error: 'Already revealed', ...this.publicState() }
    if (this.bank < VOWEL_COST) return { error: 'Not enough points for a vowel', ...this.publicState() }

    this.bank -= VOWEL_COST
    this.lastWedge = null
    const count = countOf(this.answer, letter)
    let correct = false
    if (count > 0) {
      this.revealed.add(letter)
      correct = true
      if (isAllRevealed(this.answer, this.revealed)) { this.over = true; this.won = true }
    }
    return { letter, vowel: true, correct, count, ...this.publicState() }
  }

  solve(attempt) {
    if (this.over) return { error: 'Game over', ...this.publicState() }
    const correct = normalizeSolve(attempt) === normalizeSolve(this.answer)
    if (correct) {
      for (const ch of distinctLetters(this.answer)) this.revealed.add(ch)
      this.over = true; this.won = true
      this.canGuess = false; this.lastWedge = null
      return { solved: true, ...this.publicState() }
    }
    this.strikes++
    if (this.strikes >= this.maxStrikes) { this.over = true; this.won = false }
    return { solved: false, ...this.publicState() }
  }
}
