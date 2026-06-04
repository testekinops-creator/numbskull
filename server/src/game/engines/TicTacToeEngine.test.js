import { describe, it, expect } from 'vitest'
import { TicTacToeEngine } from './TicTacToeEngine.js'

describe('TicTacToeEngine', () => {
  it('starts with an empty board and X to move', () => {
    const e = new TicTacToeEngine()
    expect(e.board).toEqual(Array(9).fill(null))
    expect(e.turn).toBe('X')
    expect(e.over).toBe(false)
  })

  it('rejects moves on occupied cells', () => {
    const e = new TicTacToeEngine({ difficulty: 'easy', symbol: 'X' })
    e.playerMove(0)               // X at 0, then AI moves somewhere
    const again = e.playerMove(0) // human tries 0 again — but it's occupied
    // 0 is occupied (by X); attempting it returns occupied OR not-your-turn —
    // either way it must be invalid.
    expect(again.valid).toBe(false)
  })

  it('rejects out-of-range cells', () => {
    const e = new TicTacToeEngine()
    expect(e.playerMove(9).valid).toBe(false)
    expect(e.playerMove(-1).valid).toBe(false)
  })

  it('detects a row winner', () => {
    expect(TicTacToeEngine.winnerOf(['X', 'X', 'X', null, null, null, null, null, null])).toBe('X')
  })

  it('detects a column winner', () => {
    expect(TicTacToeEngine.winnerOf(['O', null, null, 'O', null, null, 'O', null, null])).toBe('O')
  })

  it('detects a diagonal winner', () => {
    expect(TicTacToeEngine.winnerOf(['X', null, null, null, 'X', null, null, null, 'X'])).toBe('X')
  })

  it('detects a full-board draw', () => {
    // X O X / X X O / O X O  → no winner, full
    const board = ['X', 'O', 'X', 'X', 'X', 'O', 'O', 'X', 'O']
    expect(TicTacToeEngine.winnerOf(board)).toBe(null)
    expect(TicTacToeEngine.isDraw(board)).toBe(true)
  })

  it('AI opens when the human picks O', () => {
    const e = new TicTacToeEngine({ difficulty: 'hard', symbol: 'O' })
    expect(e.aiSymbol).toBe('X')
    const state = e.aiOpeningMove()
    expect(state.board.filter(c => c === 'X').length).toBe(1)
    expect(state.turn).toBe('O') // now the human's turn
  })

  it('playerMove returns the AI response move', () => {
    const e = new TicTacToeEngine({ difficulty: 'hard', symbol: 'X' })
    const res = e.playerMove(4) // human takes center
    expect(res.valid).toBe(true)
    expect(typeof res.aiMove).toBe('number')
    expect(res.board.filter(c => c !== null).length).toBe(2)
  })

  it('hard AI is unbeatable — it never loses across many random games', () => {
    // The human plays random legal moves; a perfect AI must win or draw, never lose.
    for (let game = 0; game < 40; game++) {
      const e = new TicTacToeEngine({ difficulty: 'hard', symbol: 'X' })
      while (!e.over) {
        const empties = e.board.map((v, i) => (v === null ? i : null)).filter(i => i !== null)
        if (empties.length === 0) break
        const pick = empties[Math.floor(Math.random() * empties.length)]
        e.playerMove(pick)
      }
      // Human is 'X', AI is 'O' → X (human) must never be the winner.
      expect(e.winner).not.toBe('X')
    }
  })

  it('marks a win for the player who completes a line', () => {
    const e = new TicTacToeEngine({ difficulty: 'easy', symbol: 'X' })
    // Force a deterministic board: give X two in a row, empty third.
    e.board = ['X', 'X', null, 'O', 'O', null, null, null, null]
    e.turn = 'X'
    const res = e.playerMove(2)
    expect(res.valid).toBe(true)
    expect(res.over).toBe(true)
    expect(res.winner).toBe('X')
  })
})
