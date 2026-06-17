import { describe, it, expect } from 'vitest'
import { TangoEngine, tangoIsValidSolution, tangoCountCorrect } from './TangoEngine.js'

// Independent solution counter (cross-check, not the code under test).
function countSolutions(givens, constraints, n, cap = 3) {
  const N = n * n, HALF = n / 2
  const cons = new Map()
  for (const { a, b, type } of constraints) {
    if (!cons.has(a)) cons.set(a, []); if (!cons.has(b)) cons.set(b, [])
    cons.get(a).push({ other: b, type }); cons.get(b).push({ other: a, type })
  }
  const toInt = (s) => (s === 'sun' ? 0 : s === 'moon' ? 1 : -1)
  const fixed = givens.map(toInt)
  const g = fixed.slice()
  const rowc = Array.from({ length: n }, () => [0, 0]), colc = Array.from({ length: n }, () => [0, 0])
  let cnt = 0
  const place = (i, v) => { g[i] = v; rowc[(i / n) | 0][v]++; colc[i % n][v]++ }
  const unplace = (i, v) => { g[i] = -1; rowc[(i / n) | 0][v]--; colc[i % n][v]-- }
  const fits = (i, v) => {
    const r = (i / n) | 0, c = i % n
    if (c >= 2 && g[i - 1] === v && g[i - 2] === v) return false
    if (r >= 2 && g[i - n] === v && g[i - 2 * n] === v) return false
    if (rowc[r][v] + 1 > HALF) return false
    if (colc[c][v] + 1 > HALF) return false
    for (const { other, type } of (cons.get(i) || [])) {
      if (other < i && g[other] !== -1) {
        if (type === 'eq' && g[other] !== v) return false
        if (type === 'neq' && g[other] === v) return false
      }
    }
    return true
  }
  const bt = (i) => {
    if (cnt >= cap) return
    if (i === N) { cnt++; return }
    if (fixed[i] !== -1) { if (fits(i, fixed[i])) { place(i, fixed[i]); bt(i + 1); unplace(i, fixed[i]) } ; return }
    for (const v of [0, 1]) { if (fits(i, v)) { place(i, v); bt(i + 1); unplace(i, v) } }
  }
  bt(0)
  return cnt
}

describe('TangoEngine generation', () => {
  it('is deterministic under a seed', () => {
    const a = TangoEngine.generate(6, 'medium', 4242)
    const b = TangoEngine.generate(6, 'medium', 4242)
    expect(a.solution).toEqual(b.solution)
    expect(a.givens).toEqual(b.givens)
    expect(a.constraints).toEqual(b.constraints)
  })

  it('produces valid, unique puzzles across difficulties & seeds', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      for (let seed = 1; seed <= 8; seed++) {
        const { n, givens, constraints, solution } = TangoEngine.generate(6, diff, seed)
        // the solution obeys every rule
        expect(tangoIsValidSolution(solution, n, constraints)).toBe(true)
        // givens are consistent with the solution
        givens.forEach((g, i) => { if (g) expect(g).toBe(solution[i]) })
        // and the puzzle has exactly one solution
        expect(countSolutions(givens, constraints, n, 3)).toBe(1)
      }
    }
  })

  it('reveals more givens on easy than on hard', () => {
    const easy = TangoEngine.generate(6, 'easy', 99).givens.filter(Boolean).length
    const hard = TangoEngine.generate(6, 'hard', 99).givens.filter(Boolean).length
    expect(easy).toBeGreaterThan(hard)
  })
})

describe('tangoIsValidSolution', () => {
  const { n, constraints, solution } = TangoEngine.generate(6, 'medium', 7)

  it('accepts the generated solution', () => {
    expect(tangoIsValidSolution(solution, n, constraints)).toBe(true)
  })
  it('rejects an incomplete board', () => {
    const b = [...solution]; b[0] = 'empty'
    expect(tangoIsValidSolution(b, n, constraints)).toBe(false)
  })
  it('rejects a row imbalance / flipped cell', () => {
    const b = [...solution]; b[0] = b[0] === 'sun' ? 'moon' : 'sun'
    expect(tangoIsValidSolution(b, n, constraints)).toBe(false)
  })
  it('rejects a broken edge constraint', () => {
    const c = constraints[0]
    if (c) {
      const b = [...solution]; b[c.b] = b[c.b] === 'sun' ? 'moon' : 'sun'
      expect(tangoIsValidSolution(b, n, constraints)).toBe(false)
    }
  })
})

describe('tangoCountCorrect', () => {
  it('counts only filled cells matching the solution', () => {
    const { solution } = TangoEngine.generate(6, 'medium', 11)
    expect(tangoCountCorrect(solution, solution)).toBe(36)
    const b = [...solution]; b[0] = 'empty'; b[1] = b[1] === 'sun' ? 'moon' : 'sun'
    expect(tangoCountCorrect(b, solution)).toBe(34)
  })
})
