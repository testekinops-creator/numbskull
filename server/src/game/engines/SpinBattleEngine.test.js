import { describe, it, expect, beforeEach } from 'vitest'
import { SpinBattleEngine, WHEEL } from './SpinBattleEngine.js'

// Force a known puzzle so tests are deterministic.
function fixed(answer = 'RED FOX', category = 'Animals') {
  const e = new SpinBattleEngine({ difficulty: 'easy' })
  e.answer = answer
  e.category = category
  e.revealed = new Set()
  e.bank = 0
  e.strikes = 0
  e.canGuess = false
  e.lastWedge = null
  e.over = false
  e.won = false
  return e
}

describe('SpinBattleEngine', () => {
  let e
  beforeEach(() => { e = fixed('RED FOX') })

  it('masks the puzzle (underscores for letters, spaces preserved)', () => {
    expect(e.masked()).toBe('___ ___')
  })

  it('spin returns a valid index/wedge and arms a consonant on a points wedge', () => {
    const r = e.spin()
    expect(r.index).toBeGreaterThanOrEqual(0)
    expect(r.index).toBeLessThan(WHEEL.length)
    expect(r.wedge).toBe(WHEEL[r.index])
    if (typeof r.wedge === 'number') {
      expect(e.canGuess).toBe(true)
      expect(e.lastWedge).toBe(r.wedge)
    }
  })

  it('cannot spin again while a consonant is pending', () => {
    e.canGuess = true; e.lastWedge = 200
    const r = e.spin()
    expect(r.error).toBeTruthy()
  })

  it('cannot guess a consonant before spinning', () => {
    const r = e.guessConsonant('R')
    expect(r.error).toBeTruthy()
  })

  it('rejects vowels as consonant guesses', () => {
    e.canGuess = true; e.lastWedge = 200
    const r = e.guessConsonant('E')
    expect(r.error).toBeTruthy()
  })

  it('a correct consonant banks points = wedge × count and reveals it', () => {
    e.canGuess = true; e.lastWedge = 200
    const r = e.guessConsonant('R')   // 1 R in "RED FOX"
    expect(r.correct).toBe(true)
    expect(r.count).toBe(1)
    expect(r.points).toBe(200)
    expect(e.bank).toBe(200)
    expect(e.masked()).toBe('R__ ___')
    expect(e.canGuess).toBe(false)    // must spin again
  })

  it('a wrong consonant adds a strike and ends the run at the limit', () => {
    for (let i = 0; i < e.maxStrikes; i++) {
      e.canGuess = true; e.lastWedge = 200
      e.guessConsonant('Z')           // not in "RED FOX"
    }
    expect(e.strikes).toBe(e.maxStrikes)
    expect(e.over).toBe(true)
    expect(e.won).toBe(false)
  })

  it('buying a vowel costs points and reveals occurrences', () => {
    e.bank = 300
    const r = e.buyVowel('O')         // 1 O in "RED FOX"
    expect(r.error).toBeUndefined()
    expect(e.bank).toBe(50)           // 300 - 250
    expect(e.revealed.has('O')).toBe(true)
    expect(e.masked()).toBe('___ _O_')
  })

  it('cannot buy a vowel without enough bank', () => {
    e.bank = 100
    const r = e.buyVowel('O')
    expect(r.error).toBeTruthy()
    expect(e.revealed.has('O')).toBe(false)
  })

  it('solving correctly wins; wrong solve adds a strike', () => {
    const wrong = e.solve('BLUE FOX')
    expect(wrong.solved).toBe(false)
    expect(e.strikes).toBe(1)

    const right = e.solve('red fox')  // case/space-insensitive
    expect(right.solved).toBe(true)
    expect(e.over).toBe(true)
    expect(e.won).toBe(true)
  })

  it('revealing every letter wins without an explicit solve', () => {
    const all = 'RDFOX'.split('')     // every distinct letter in "RED FOX" minus the vowel E
    e.canGuess = true; e.lastWedge = 100; e.guessConsonant('R')
    e.canGuess = true; e.lastWedge = 100; e.guessConsonant('D')
    e.canGuess = true; e.lastWedge = 100; e.guessConsonant('F')
    e.canGuess = true; e.lastWedge = 100; e.guessConsonant('X')
    e.bank = 300; e.buyVowel('E')
    e.bank = 300; e.buyVowel('O')
    expect(e.over).toBe(true)
    expect(e.won).toBe(true)
    void all
  })

  // Force the wheel to land on a specific wedge (mid-segment → float-safe).
  function forceWedge(label, fn) {
    const idx = WHEEL.indexOf(label)
    const orig = Math.random
    Math.random = () => (idx + 0.5) / WHEEL.length
    try { return fn(e.spin()) } finally { Math.random = orig }
  }

  it('bankrupt wedge wipes the bank', () => {
    e.bank = 5000
    forceWedge('BANKRUPT', r => { expect(r.effect).toBe('bankrupt'); expect(e.bank).toBe(0) })
  })

  it('double wedge doubles the bank', () => {
    e.bank = 600
    forceWedge('DOUBLE', r => { expect(r.effect).toBe('double'); expect(e.bank).toBe(1200) })
  })

  it('jackpot wedge adds a flat bonus', () => {
    e.bank = 200
    forceWedge('JACKPOT', r => { expect(r.effect).toBe('jackpot'); expect(e.bank).toBe(1200) })
  })

  it('steal wedge is a solo bonus', () => {
    e.bank = 100
    forceWedge('STEAL', r => { expect(r.effect).toBe('steal'); expect(e.bank).toBe(500) })
  })

  it('a number wedge arms a consonant', () => {
    forceWedge(800, r => { expect(r.effect).toBe('points'); expect(e.canGuess).toBe(true); expect(e.lastWedge).toBe(800) })
  })

  it('shield wedge raises a shield', () => {
    forceWedge('SHIELD', r => { expect(r.effect).toBe('shield'); expect(e.shield).toBe(true) })
  })

  it('a shield blocks the next bankrupt and is consumed', () => {
    e.bank = 1500; e.shield = true
    forceWedge('BANKRUPT', r => {
      expect(r.effect).toBe('bankrupt_blocked')
      expect(e.bank).toBe(1500)   // preserved
      expect(e.shield).toBe(false) // consumed
    })
  })

  it('freeze is a solo bonus', () => {
    e.bank = 100
    forceWedge('FREEZE', r => { expect(r.effect).toBe('freeze'); expect(e.bank).toBe(350) })
  })

  it('public state hides the answer until the game is over', () => {
    expect(e.publicState().answer).toBeUndefined()
    e.solve('RED FOX')
    expect(e.publicState().answer).toBe('RED FOX')
  })
})
