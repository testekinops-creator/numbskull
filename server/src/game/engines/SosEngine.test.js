import { describe, it, expect } from 'vitest'
import { SosEngine } from './SosEngine.js'

// Helper: build a flat board of given size from a 2D char map (' ' = empty).
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

describe('SosEngine.linesAt', () => {
  it('detects a horizontal S-O-S when the middle O is placed (size 3)', () => {
    const b = Array(9).fill(null)
    b[0] = 'S'; b[2] = 'S'; b[1] = 'O'           // row 0: S O S
    expect(SosEngine.linesAt(b, 3, 1)).toEqual([[0, 1, 2]])
  })

  it('detects when the final S endpoint is placed', () => {
    const b = Array(9).fill(null)
    b[0] = 'S'; b[1] = 'O'; b[2] = 'S'           // place the right S
    expect(SosEngine.linesAt(b, 3, 2)).toEqual([[0, 1, 2]])
  })

  it('detects vertical and both diagonals', () => {
    const v = Array(9).fill(null); v[0] = 'S'; v[6] = 'S'; v[3] = 'O'
    expect(SosEngine.linesAt(v, 3, 3)).toEqual([[0, 3, 6]])
    const d = Array(9).fill(null); d[0] = 'S'; d[8] = 'S'; d[4] = 'O'
    expect(SosEngine.linesAt(d, 3, 4)).toEqual([[0, 4, 8]])
    const a = Array(9).fill(null); a[2] = 'S'; a[6] = 'S'; a[4] = 'O'
    expect(SosEngine.linesAt(a, 3, 4)).toEqual([[2, 4, 6]])
  })

  it('a single move can complete multiple SOS at once', () => {
    const b = Array(9).fill('S'); b[4] = null     // all S around an empty centre
    b[4] = 'O'                                     // place the O in the middle
    const lines = SosEngine.linesAt(b, 3, 4)
    expect(lines.length).toBe(4)                   // 4 axes through the centre
  })

  it('no false positives (incomplete or wrong letters)', () => {
    const b = Array(9).fill(null)
    b[0] = 'S'; b[2] = 'O'; b[1] = 'O'             // S O O — not an SOS
    expect(SosEngine.linesAt(b, 3, 1)).toEqual([])
    const lone = Array(9).fill(null); lone[0] = 'S'
    expect(SosEngine.linesAt(lone, 3, 0)).toEqual([])
  })

  it('respects bounds (no wraparound across rows)', () => {
    const b = Array(9).fill(null)
    b[2] = 'S'; b[3] = 'O'; b[4] = 'S'             // 2,3,4 are NOT a straight line
    expect(SosEngine.linesAt(b, 3, 3)).toEqual([])
  })
})

describe('SosEngine.isFull', () => {
  it('is true only when every cell is filled', () => {
    expect(SosEngine.isFull(['S', 'O', 'S'])).toBe(true)
    expect(SosEngine.isFull(['S', null, 'S'])).toBe(false)
  })
})

describe('SosEngine playerMove', () => {
  it('scores and keeps the turn (bonus) without running the AI', () => {
    const e = new SosEngine({ boardSize: 8 })
    e.board[0] = 'S'; e.board[1] = 'O'             // poised for an SOS at 0-1-2
    const r = e.playerMove(2, 'S')
    expect(r.valid).toBe(true)
    expect(r.formed).toEqual([[0, 1, 2]])
    expect(r.scores.player).toBe(1)
    expect(r.turn).toBe('player')                  // bonus turn
    expect(r.aiMoves).toEqual([])
  })

  it('hands the turn to the AI on a non-scoring placement', () => {
    const e = new SosEngine({ boardSize: 8, difficulty: 'easy' })
    const r = e.playerMove(0, 'S')                 // cannot form an SOS alone
    expect(r.formed).toEqual([])
    expect(r.aiMoves.length).toBeGreaterThanOrEqual(1)
    expect(r.over || r.turn === 'player').toBe(true)
  })

  it('awards a combo bonus for a multi-SOS move', () => {
    const e = new SosEngine({ boardSize: 8 })
    // Placing O at 9 completes BOTH diagonals: (0,9,18) and (2,9,16).
    e.board[0] = 'S'; e.board[18] = 'S'; e.board[2] = 'S'; e.board[16] = 'S'
    const r = e.playerMove(9, 'O')
    expect(r.formed.length).toBe(2)
    expect(r.scores.player).toBe(3)        // 2 lines + 1 combo bonus
  })

  it('rejects bad input', () => {
    const e = new SosEngine({ boardSize: 8 })
    expect(e.playerMove(0, 'X').valid).toBe(false)
    e.board[0] = 'S'
    expect(e.playerMove(0, 'S').valid).toBe(false) // occupied
  })

  it('ends on a full board and picks the higher score (and ties draw)', () => {
    const win = new SosEngine({ boardSize: 8 })
    for (let i = 0; i < 64; i++) win.board[i] = 'O'; win.board[63] = null
    win.scores = { player: 3, ai: 5 }
    const r = win.playerMove(63, 'O')              // O with no flanking S → no SOS
    expect(r.over).toBe(true)
    expect(r.winner).toBe('ai')
    expect(r.draw).toBe(false)

    const tie = new SosEngine({ boardSize: 8 })
    for (let i = 0; i < 64; i++) tie.board[i] = 'O'; tie.board[63] = null
    tie.scores = { player: 4, ai: 4 }
    const t = tie.playerMove(63, 'O')
    expect(t.over).toBe(true)
    expect(t.winner).toBe(null)
    expect(t.draw).toBe(true)
  })
})

describe('SosEngine.bestMove', () => {
  it('returns a valid empty cell with a letter', () => {
    const b = Array(64).fill(null)
    const mv = SosEngine.bestMove(b, 8, 'medium')
    expect(b[mv.cell]).toBe(null)
    expect(['S', 'O']).toContain(mv.letter)
  })

  it('takes a scoring move when one exists', () => {
    const b = Array(64).fill(null)
    b[0] = 'S'; b[1] = 'O'                          // placing S at 2 scores
    const mv = SosEngine.bestMove(b, 8, 'hard')
    b[mv.cell] = mv.letter
    expect(SosEngine.linesAt(b, 8, mv.cell).length).toBeGreaterThan(0)
  })
})

describe('SosEngine.neutralMove (timeout auto-move)', () => {
  it('returns null on a full board', () => {
    expect(SosEngine.neutralMove(Array(64).fill('S'), 8)).toBe(null)
  })

  it('AVOIDS scoring when a non-scoring move is available', () => {
    const b = Array(64).fill(null)
    b[0] = 'S'; b[1] = 'O'                          // placing S at 2 WOULD score
    // Lots of empty cells → plenty of non-scoring options exist.
    for (let i = 0; i < 200; i++) {
      const mv = SosEngine.neutralMove([...b], 8)
      const probe = [...b]; probe[mv.cell] = mv.letter
      expect(SosEngine.linesAt(probe, 8, mv.cell).length).toBe(0)   // never scores
    }
  })

  it('scores only when EVERY remaining move would form an S-O-S (forced)', () => {
    // Fill the board so cell 1 is the only empty, and BOTH letters there score:
    //  • O at 1 completes the horizontal 0-1-2 (S O S)
    //  • S at 1 completes the vertical   1-9-17 (S O S)
    const b = Array(64).fill('S')
    b[9] = 'O'                                       // vertical middle
    b[1] = null                                      // the only empty cell
    const mv = SosEngine.neutralMove(b, 8)
    expect(mv).not.toBeNull()
    expect(mv.cell).toBe(1)
    const probe = [...b]; probe[mv.cell] = mv.letter
    expect(SosEngine.linesAt(probe, 8, mv.cell).length).toBeGreaterThan(0)  // forced to score
  })
})
