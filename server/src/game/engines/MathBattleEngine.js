// Math Battle — a 20-question speed quiz. Both players (or player vs AI) race to
// answer the SAME question; the first correct/incorrect answer locks it (±1).
// The engine owns question generation and answer checking; progression and
// scoring are managed by the caller (REST route for AI, matchHandlers for MP)
// so the same engine serves both flows. Correct answers never leave the server.

import { MathBattleAI } from '../ai/MathBattleAI.js'

const OPS = ['+', '-', '*', '/']

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export class MathBattleEngine {
  constructor({ difficulty = 'medium', count = 20 } = {}) {
    this.difficulty = difficulty
    this.count = count
    this.questions = MathBattleEngine.generate(count, difficulty)
    this.range = null
  }

  get total() { return this.count }

  static generate(count, difficulty) {
    const qs = []
    for (let i = 0; i < count; i++) qs.push(MathBattleEngine.makeQuestion(difficulty))
    return qs
  }

  static makeQuestion(difficulty) {
    const op  = OPS[rnd(0, OPS.length - 1)]
    const big = difficulty === 'hard' ? 50 : difficulty === 'easy' ? 12 : 25
    const fac = difficulty === 'hard' ? 15 : difficulty === 'easy' ? 9  : 12
    let a, b, answer, sym

    switch (op) {
      case '+': a = rnd(1, big); b = rnd(1, big);  answer = a + b; sym = '+'; break
      case '-': a = rnd(1, big); b = rnd(0, a);    answer = a - b; sym = '−'; break  // never negative
      case '*': a = rnd(2, fac); b = rnd(2, fac);  answer = a * b; sym = '×'; break
      default:  b = rnd(2, fac); answer = rnd(2, fac); a = b * answer; sym = '÷'; break // exact division
    }

    return { prompt: `${a} ${sym} ${b}`, options: MathBattleEngine.makeOptions(answer), answer }
  }

  // Four distinct options including the correct answer, all non-negative.
  static makeOptions(answer) {
    const set = new Set([answer])
    const spread = Math.max(4, Math.round(Math.abs(answer) * 0.4) + 2)
    let guard = 0
    while (set.size < 4 && guard++ < 60) {
      let cand = answer + rnd(1, spread) * (Math.random() < 0.5 ? -1 : 1)
      if (cand < 0) cand = answer + rnd(1, spread)
      set.add(cand)
    }
    let n = answer + 1
    while (set.size < 4) { set.add(n); n++ }   // fallback to guarantee 4
    return shuffle([...set])
  }

  // Question without the answer — safe to send to clients.
  publicQuestion(i) {
    const q = this.questions[i]
    if (!q) return null
    return { index: i, prompt: q.prompt, options: q.options, total: this.count }
  }

  getState() {
    return { question: this.publicQuestion(0), total: this.count }
  }

  // Validate a choice for a given question index.
  check(index, choice) {
    const q = this.questions[index]
    if (!q) return { valid: false, error: 'No such question' }
    return { valid: true, correct: Number(choice) === q.answer, answer: q.answer }
  }

  // Single-player AI mode: does the AI get this question right?
  aiAnswersCorrectly() {
    return MathBattleAI.answersCorrectly(this.difficulty)
  }
}
