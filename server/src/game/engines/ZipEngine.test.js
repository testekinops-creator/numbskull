import { describe, it, expect } from 'vitest'
import { ZipEngine, zipIsValidSolution, zipIsValidPartial, zipProgress, neighbors } from './ZipEngine.js'

// Independent solution counter (cross-check, not the engine internals).
function countSolutions(n, numbers, walls, cap = 3) {
  const N = n * n
  const wk = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const ws = new Set(walls.map(w => wk(w.a, w.b)))
  const K = Math.max(0, ...numbers)
  const start = numbers.indexOf(1)
  const adj = []
  for (let i = 0; i < N; i++) adj.push(neighbors(i, n).filter(j => !ws.has(wk(i, j))))
  const seen = new Array(N).fill(false)
  let cnt = 0
  const stranded = (cur) => {
    for (let i = 0; i < N; i++) {
      if (seen[i] || adj[i].includes(cur)) continue
      if (!adj[i].some(j => !seen[j])) return true
    }
    return false
  }
  const bt = (cur, count, nextExp) => {
    if (cnt >= cap) return
    if (count === N) { if (nextExp === K + 1 && numbers[cur] === K) cnt++; return }
    if (stranded(cur)) return
    for (const nb of adj[cur]) {
      if (seen[nb]) continue
      const m = numbers[nb]
      if (m > 0 && m !== nextExp) continue
      seen[nb] = true; bt(nb, count + 1, m > 0 ? nextExp + 1 : nextExp); seen[nb] = false
    }
  }
  seen[start] = true; bt(start, 1, 2)
  return cnt
}

describe('ZipEngine generation', () => {
  it('is deterministic under a seed', () => {
    const a = ZipEngine.generate(6, 'medium', 31415)
    const b = ZipEngine.generate(6, 'medium', 31415)
    expect(a.solution).toEqual(b.solution)
    expect(a.numbers).toEqual(b.numbers)
    expect(a.walls).toEqual(b.walls)
  })

  it('produces valid, unique puzzles across difficulties & seeds', () => {
    for (const diff of ['easy', 'medium', 'hard']) {
      for (let seed = 1; seed <= 6; seed++) {
        const { n, numbers, walls, solution } = ZipEngine.generate(6, diff, seed)
        // the solution path covers the whole grid and obeys every rule
        expect(zipIsValidSolution(solution, n, numbers, walls)).toBe(true)
        // numbers run 1..K with 1 at the path start and K at the end
        const K = Math.max(...numbers)
        expect(numbers[solution[0]]).toBe(1)
        expect(numbers[solution[solution.length - 1]]).toBe(K)
        // and exactly one solution
        expect(countSolutions(n, numbers, walls, 3)).toBe(1)
      }
    }
  })
})

describe('zipIsValidSolution / partial', () => {
  const { n, numbers, walls, solution } = ZipEngine.generate(6, 'medium', 7)

  it('accepts the solution and legal prefixes', () => {
    expect(zipIsValidSolution(solution, n, numbers, walls)).toBe(true)
    expect(zipIsValidPartial(solution.slice(0, 10), n, numbers, walls)).toBe(true)
    expect(zipIsValidPartial([], n, numbers, walls)).toBe(true)
  })
  it('rejects an incomplete path as a solution', () => {
    expect(zipIsValidSolution(solution.slice(0, -1), n, numbers, walls)).toBe(false)
  })
  it('rejects a partial that does not start at 1', () => {
    expect(zipIsValidPartial([solution[1], solution[2]], n, numbers, walls)).toBe(false)
  })
  it('rejects a non-adjacent jump', () => {
    const bad = [solution[0], solution[0] + 2]
    expect(zipIsValidPartial(bad, n, numbers, walls)).toBe(false)
  })
  it('rejects revisiting a cell', () => {
    const bad = [solution[0], solution[1], solution[0]]
    expect(zipIsValidPartial(bad, n, numbers, walls)).toBe(false)
  })
})

describe('zipProgress', () => {
  it('is the path length', () => {
    expect(zipProgress([])).toBe(0)
    expect(zipProgress([3, 4, 5])).toBe(3)
  })
})
