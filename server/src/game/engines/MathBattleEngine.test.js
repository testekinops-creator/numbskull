import { describe, it, expect } from 'vitest'
import { MathBattleEngine } from './MathBattleEngine.js'

// Recompute a prompt's answer independently, to verify generation is correct.
// Handles all question types: arithmetic, squares, percentages, sequences.
function evalPrompt(prompt) {
  if (prompt.endsWith('²')) {                       // "N²"
    const n = Number(prompt.slice(0, -1))
    return n * n
  }
  const pct = prompt.match(/^(\d+)% of (\d+)$/)     // "p% of base"
  if (pct) return Math.round(Number(pct[1]) * Number(pct[2]) / 100)
  if (prompt.includes(', ')) {                      // "a, b, c, ?"
    const nums = (prompt.match(/\d+/g) || []).map(Number)
    const d = nums[1] - nums[0]
    return nums[nums.length - 1] + d
  }
  const [aStr, sym, bStr] = prompt.split(' ')        // "a sym b"
  const a = Number(aStr), b = Number(bStr)
  switch (sym) {
    case '+': return a + b
    case '−': return a - b
    case '×': return a * b
    case '÷': return a / b
    default:  throw new Error(`Unknown symbol ${sym}`)
  }
}

describe('MathBattleEngine', () => {
  it('generates the requested number of questions', () => {
    const e = new MathBattleEngine({ count: 20 })
    expect(e.questions.length).toBe(20)
    expect(e.total).toBe(20)
  })

  it('every question has exactly 4 distinct options including the answer', () => {
    const e = new MathBattleEngine({ count: 40, difficulty: 'hard' })
    for (const q of e.questions) {
      expect(q.options.length).toBe(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
      q.options.forEach(o => expect(Number.isInteger(o)).toBe(true))
    }
  })

  it('stored answer always matches the prompt arithmetic', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      const e = new MathBattleEngine({ count: 60, difficulty: diff })
      for (const q of e.questions) {
        expect(q.answer).toBe(evalPrompt(q.prompt))
      }
    }
  })

  it('subtraction is never negative and division is always exact', () => {
    const e = new MathBattleEngine({ count: 100 })
    for (const q of e.questions) {
      if (q.prompt.includes('−')) expect(q.answer).toBeGreaterThanOrEqual(0)
      if (q.prompt.includes('÷')) expect(Number.isInteger(q.answer)).toBe(true)
      expect(q.options.every(o => o >= 0)).toBe(true)
    }
  })

  it('publicQuestion hides the answer', () => {
    const e = new MathBattleEngine({ count: 5 })
    const pub = e.publicQuestion(0)
    expect(pub).toHaveProperty('prompt')
    expect(pub).toHaveProperty('options')
    expect(pub).not.toHaveProperty('answer')
    expect(pub.index).toBe(0)
    expect(pub.total).toBe(5)
  })

  it('check() scores correct and incorrect choices', () => {
    const e = new MathBattleEngine({ count: 3 })
    const q = e.questions[0]
    const wrong = q.options.find(o => o !== q.answer)
    expect(e.check(0, q.answer)).toMatchObject({ valid: true, correct: true, answer: q.answer })
    expect(e.check(0, wrong)).toMatchObject({ valid: true, correct: false })
  })

  it('check() handles string choices (from socket payloads)', () => {
    const e = new MathBattleEngine({ count: 1 })
    const q = e.questions[0]
    expect(e.check(0, String(q.answer)).correct).toBe(true)
  })

  it('check() rejects an out-of-range index', () => {
    const e = new MathBattleEngine({ count: 2 })
    expect(e.check(99, 0).valid).toBe(false)
  })
})
