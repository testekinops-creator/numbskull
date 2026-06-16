import { describe, it, expect } from 'vitest'
import {
  RummyEngine, buildDeck, validateDeclaration, handPoints,
  isPureSequenceGroup, isSequenceGroup, isSetGroup, classifyGroup, sortHand,
} from './RummyEngine.js'

// Card builders matching the engine's id scheme.
const c = (rank, suit, deck = 0) => ({ id: `${rank}${suit}_${deck}`, rank, suit })
const jk = (n) => ({ id: `JK_${n}`, rank: 'JOKER', suit: 'JOKER' })
const ids = (...cards) => cards.map(x => x.id)

describe('deck & deal', () => {
  it('builds 2 decks + 2 printed jokers = 106 unique cards', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(106)
    expect(new Set(deck.map(x => x.id)).size).toBe(106)
    expect(deck.filter(x => x.suit === 'JOKER')).toHaveLength(2)
  })

  it('deals 13 to each player and sets up wild/discard/stock', () => {
    const e = new RummyEngine({ playerIds: ['a', 'b', 'c'], seed: 42 })
    expect(e.hands.a).toHaveLength(13)
    expect(e.hands.b).toHaveLength(13)
    expect(e.hands.c).toHaveLength(13)
    expect(e.discard).toHaveLength(1)
    expect(e.wildJoker).toBeTruthy()
    expect(e.wildRank).toBeTruthy()
    // 106 − 3×13 − 1 wild − 1 discard = 65 left in stock.
    expect(e.stock).toHaveLength(106 - 39 - 1 - 1)
  })

  it('is deterministic for a given seed', () => {
    const a = new RummyEngine({ playerIds: ['x', 'y'], seed: 7 })
    const b = new RummyEngine({ playerIds: ['x', 'y'], seed: 7 })
    expect(a.hands.x.map(z => z.id)).toEqual(b.hands.x.map(z => z.id))
    expect(a.wildJoker.id).toBe(b.wildJoker.id)
  })

  it('printed-joker cut makes Ace the wild rank', () => {
    // Find a seed where the cut card is a printed joker is flaky; instead assert
    // the rule directly via a tiny deal and the documented invariant.
    const e = new RummyEngine({ playerIds: ['a', 'b'], seed: 1 })
    if (e.wildJoker.suit === 'JOKER') expect(e.wildRank).toBe('A')
    else expect(e.wildRank).toBe(e.wildJoker.rank)
  })
})

describe('pure sequence', () => {
  it('accepts a clean same-suit run', () => {
    expect(isPureSequenceGroup([c('5', 'H'), c('6', 'H'), c('7', 'H')], '2')).toBe(true)
  })
  it('accepts Ace-low (A-2-3) and Ace-high (Q-K-A)', () => {
    expect(isPureSequenceGroup([c('A', 'S'), c('2', 'S'), c('3', 'S')], '9')).toBe(true)
    expect(isPureSequenceGroup([c('Q', 'D'), c('K', 'D'), c('A', 'D')], '9')).toBe(true)
  })
  it('rejects the K-A-2 wrap', () => {
    expect(isPureSequenceGroup([c('K', 'C'), c('A', 'C'), c('2', 'C')], '9')).toBe(false)
  })
  it('rejects a printed joker (impure) and mixed suits', () => {
    expect(isPureSequenceGroup([c('5', 'H'), c('6', 'H'), jk(0)], '2')).toBe(false)
    expect(isPureSequenceGroup([c('5', 'H'), c('6', 'S'), c('7', 'H')], '2')).toBe(false)
  })
  it('a wild-rank card used at its natural value still counts as pure', () => {
    // wild rank = 5 → the 5♥ sits at its natural slot in 4-5-6♥ → pure.
    expect(isPureSequenceGroup([c('4', 'H'), c('5', 'H'), c('6', 'H')], '5')).toBe(true)
  })
})

describe('impure sequence (jokers fill gaps)', () => {
  it('fills a gap with a printed joker', () => {
    expect(isSequenceGroup([c('5', 'H'), c('7', 'H'), jk(0)], '2')).toBe(true)  // 5-[6]-7
    expect(isSequenceGroup([c('5', 'H'), c('6', 'H'), jk(0)], '2')).toBe(true)  // 5-6-[7]
  })
  it('fills with a wild-rank card acting as wild', () => {
    // wild rank = K → KH acts as the missing 6.
    expect(isSequenceGroup([c('5', 'H'), c('7', 'H'), c('K', 'H')], 'K')).toBe(true)
  })
  it('still rejects different suits', () => {
    expect(isSequenceGroup([c('5', 'H'), c('6', 'S'), jk(0)], '2')).toBe(false)
  })
})

describe('sets', () => {
  it('accepts same-rank distinct suits, size 3 and 4', () => {
    expect(isSetGroup([c('7', 'C'), c('7', 'H'), c('7', 'S')], '2')).toBe(true)
    expect(isSetGroup([c('7', 'C'), c('7', 'H'), c('7', 'S'), c('7', 'D')], '2')).toBe(true)
  })
  it('accepts a joker in a set', () => {
    expect(isSetGroup([c('7', 'C'), c('7', 'H'), jk(0)], '2')).toBe(true)
  })
  it('rejects duplicate suits and size > 4', () => {
    expect(isSetGroup([c('7', 'C'), c('7', 'C', 1), c('7', 'H')], '2')).toBe(false)
    expect(isSetGroup([c('7', 'C'), c('7', 'H'), c('7', 'S'), c('7', 'D'), c('7', 'C', 1)], '2')).toBe(false)
  })
})

describe('classifyGroup', () => {
  it('flags pure, sequence and set correctly', () => {
    expect(classifyGroup([c('3', 'H'), c('4', 'H'), c('5', 'H')], '2')).toMatchObject({ meld: true, sequence: true, pure: true })
    expect(classifyGroup([c('3', 'H'), c('5', 'H'), jk(0)], '2')).toMatchObject({ meld: true, sequence: true, pure: false })
    expect(classifyGroup([c('9', 'C'), c('9', 'H'), c('9', 'D')], '2')).toMatchObject({ meld: true, sequence: false, pure: false })
    expect(classifyGroup([c('9', 'C'), c('2', 'H'), c('5', 'D')], '2')).toMatchObject({ meld: false })
  })
})

describe('validateDeclaration', () => {
  // A valid 13-card hand: pure(3) + impure-seq(3) + set(3) + set(4), wild rank '2'.
  const pure = [c('3', 'H'), c('4', 'H'), c('5', 'H')]
  const seq2 = [c('6', 'S'), c('7', 'S'), jk(0)]
  const set3 = [c('9', 'C'), c('9', 'H'), c('9', 'D')]
  const set4 = [c('K', 'C'), c('K', 'H'), c('K', 'S'), c('K', 'D')]
  const hand = [...pure, ...seq2, ...set3, ...set4]

  it('accepts a valid declaration (≥2 sequences, ≥1 pure)', () => {
    const groups = [ids(...pure), ids(...seq2), ids(...set3), ids(...set4)]
    expect(validateDeclaration(hand, groups, '2')).toEqual({ valid: true })
  })

  it('rejects when there is no pure sequence', () => {
    const seqA = [c('6', 'S'), c('7', 'S'), jk(0)]
    const seqB = [c('9', 'H'), c('10', 'H'), jk(1)]
    const setX = [c('4', 'C'), c('4', 'H'), c('4', 'D')]
    const setY = [c('5', 'C'), c('5', 'H'), c('5', 'S'), c('5', 'D')]
    const h = [...seqA, ...seqB, ...setX, ...setY]
    const groups = [ids(...seqA), ids(...seqB), ids(...setX), ids(...setY)]
    expect(validateDeclaration(h, groups, '2')).toEqual({ valid: false, reason: 'Need at least one pure sequence' })
  })

  it('rejects when there are fewer than two sequences', () => {
    const set3b = [c('8', 'C'), c('8', 'H'), c('8', 'S')]   // distinct ranks from pure/sets
    const h = [...pure, ...set3, ...set4, ...set3b]         // pure + 3 sets = only 1 sequence
    const groups = [ids(...pure), ids(...set3), ids(...set4), ids(...set3b)]
    expect(validateDeclaration(h, groups, '2')).toEqual({ valid: false, reason: 'Need at least two sequences' })
  })

  it('rejects a group smaller than 3', () => {
    const groups = [ids(...pure), ids(...seq2), ids(...set3), ids(c('K', 'C'), c('K', 'H')), ids(c('K', 'S'), c('K', 'D'))]
    expect(validateDeclaration(hand, groups, '2').valid).toBe(false)
  })

  it('rejects when not all 13 cards are used', () => {
    const groups = [ids(...pure), ids(...seq2), ids(...set3)]  // 9 cards
    expect(validateDeclaration(hand, groups, '2')).toEqual({ valid: false, reason: 'Use all 13 cards' })
  })

  it('rejects a card that is not in hand', () => {
    const groups = [ids(...pure), ids(...seq2), ids(...set3), ids(c('K', 'C'), c('K', 'H'), c('A', 'S'))]
    expect(validateDeclaration(hand, groups, '2').valid).toBe(false)
  })
})

describe('handPoints (full count)', () => {
  it('sums values, jokers count 0', () => {
    expect(handPoints([c('K', 'H'), c('Q', 'H'), c('5', 'C'), jk(0)], '2')).toBe(25)
  })
  it('caps at 80', () => {
    const big = Array.from({ length: 9 }, (_, i) => c('K', 'H', i))  // 90 → cap 80
    expect(handPoints(big, '2')).toBe(80)
  })
  it('treats the wild rank as 0', () => {
    expect(handPoints([c('5', 'C'), c('5', 'H')], '5')).toBe(0)
  })
})

describe('sortHand', () => {
  it('groups by suit then rank, jokers last', () => {
    const sorted = sortHand([jk(0), c('5', 'H'), c('2', 'H'), c('A', 'S')])
    expect(sorted.map(x => x.id)).toEqual(['AS_0', '2H_0', '5H_0', 'JK_0'])
  })
})
