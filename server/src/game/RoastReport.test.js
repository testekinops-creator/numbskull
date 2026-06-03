import { describe, it, expect } from 'vitest'
import { generateRoastReport } from './RoastReport.js'

describe('RoastReport', () => {
  it('generates a GTN report', () => {
    const report = generateRoastReport({ mode: 'GTN', secret: '42', guesses: [50, 25, 37, 43, 40, 42], timeMs: 8000 })
    expect(report.mode).toBe('GTN')
    expect(report.secret).toBe(42)
    expect(report.actual).toBe(6)
    expect(report.optimal).toBeGreaterThan(0)
    expect(report.grade).toMatch(/^[SABCD]$/)
    expect(typeof report.comment).toBe('string')
  })

  it('gives S grade for optimal GTN play', () => {
    const report = generateRoastReport({ mode: 'GTN', secret: '50', guesses: [50], timeMs: 1000 })
    expect(report.grade).toBe('S')
  })

  it('gives lower grade for many guesses', () => {
    const manyGuesses = [99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 50]
    const report = generateRoastReport({ mode: 'GTN', secret: '50', guesses: manyGuesses, timeMs: 30000 })
    expect(['C','D']).toContain(report.grade)
  })

  it('generates a BC report', () => {
    const report = generateRoastReport({ mode: 'BC', secret: '1234', guesses: ['5678','1234'], timeMs: 5000 })
    expect(report.mode).toBe('BC')
    expect(report.optimal).toBe(5)
    expect(report.grade).toMatch(/^[SABCD]$/)
  })

  it('includes optimalPath for GTN', () => {
    const report = generateRoastReport({ mode: 'GTN', secret: '50', guesses: [50], timeMs: 500 })
    expect(Array.isArray(report.optimalPath)).toBe(true)
    expect(report.optimalPath).toContain(50)
  })

  it('returns null for unknown mode', () => {
    expect(generateRoastReport({ mode: 'UNKNOWN', secret: '1', guesses: [] })).toBeNull()
  })
})
