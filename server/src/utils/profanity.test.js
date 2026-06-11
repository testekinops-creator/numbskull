import { describe, it, expect } from 'vitest'
import { cleanText, isProfane } from './profanity.js'

describe('profanity filter', () => {
  it('masks a flagged word, preserving length', () => {
    expect(cleanText('you shit')).toBe('you ****')
    expect(cleanText('SHIT happens')).toBe('**** happens')
  })

  it('masks the longest match fully (no partial leftovers)', () => {
    expect(cleanText('you motherfucker')).toBe('you ************')
  })

  it('leaves innocent lookalikes untouched (no false positives)', () => {
    expect(cleanText('what a class act')).toBe('what a class act')
    expect(cleanText('the assassin in Scunthorpe')).toBe('the assassin in Scunthorpe')
  })

  it('only matches whole words', () => {
    // "shitake" should not be masked (boundary), "shit." should be (punctuation is a boundary)
    expect(cleanText('shitake mushrooms')).toBe('shitake mushrooms')
    expect(cleanText('oh shit.')).toBe('oh ****.')
  })

  it('returns non-strings unchanged', () => {
    expect(cleanText(null)).toBe(null)
    expect(cleanText(42)).toBe(42)
  })

  it('isProfane flags correctly', () => {
    expect(isProfane('clean message')).toBe(false)
    expect(isProfane('a bitch about it')).toBe(true)
  })
})
