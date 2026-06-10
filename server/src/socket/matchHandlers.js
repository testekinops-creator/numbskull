// Multiplayer handlers for the "match" family of modes (XOX, and later MATH /
// SUDOKU). These reuse the room lifecycle from roomHandlers.js (create / join /
// quick-match / reconnect / disconnect-grace / rematch) and only add the
// game-specific real-time logic. State lives on `room.match` so the GTN/BC
// guess flow (room.round) is left completely untouched.

import { roomManager } from '../game/RoomManager.js'
import { cancelRoomGrace } from './roomHandlers.js'
import { getTimer, clearTimer } from '../game/TurnTimer.js'
import { TicTacToeEngine } from '../game/engines/TicTacToeEngine.js'
import { MathBattleEngine } from '../game/engines/MathBattleEngine.js'
import { SudokuEngine } from '../game/engines/SudokuEngine.js'
import { SosEngine } from '../game/engines/SosEngine.js'
import {
  WHEEL, VOWEL_COST, EXTRA_TURN_BONUS, JACKPOT_BONUS, STEAL_AMOUNT, pickPuzzle, spinWheel,
  countOf, isAllRevealed, maskAnswer, normalizeSolve, isVowel, isConsonant, distinctLetters,
} from '../game/engines/SpinBattleEngine.js'
import { recordResult } from '../game/MonthlyLeaderboard.js'
import { logger } from '../utils/logger.js'

export const MATCH_MODES = new Set(['XOX', 'MATH', 'SUDOKU', 'SPIN', 'SOS'])

// SOS: per-move timer. On expiry we auto-claim any owed lines and pass the turn
// — never forfeit the whole match.
const SOS_TURN_MS = 20_000

// Spin Battle: best-of-3 rounds; a short pause between rounds to read the board.
const SPIN_BEST_OF = 3
// A player's window to act on their turn — shown as a visible synced countdown.
const SPIN_TURN_MS = 60_000
// Visible, synchronized between-rounds countdown (tunable ≤ 60000). Both players
// see identical values because the server broadcasts remaining ms, not a clock.
const SPIN_ROUND_COUNTDOWN_MS = 8000

// Per-question timers for Math Battle (separate from the 30s XOX TurnTimer).
const mathTimers = new Map()
const MATH_QUESTION_MS = 15_000
const MATH_REVEAL_MS = 1200
function _clearMathTimer(roomId) {
  const t = mathTimers.get(roomId)
  if (t) { clearTimeout(t); mathTimers.delete(roomId) }
}

// Sudoku timing: a transient edit lock auto-releases after 3s (so a cell never
// stays stuck for the other player), and a wrong cell can be cleared by either
// player after a short cooldown (safety valve).
const SUDOKU_LOCK_TTL = 3_000
const SUDOKU_WRONG_COOLDOWN = 8_000
// Per-player cumulative mistake cap — hit it and you forfeit the duel.
// Easier puzzles allow more slack; hard is unforgiving (fits the game's tone).
const SUDOKU_MISTAKE_LIMIT = { easy: 8, medium: 6, hard: 5 }
const sudokuLockTimers = new Map()  // `${roomId}:${index}` -> timeout

function _clearSudokuLockTimer(roomId, index) {
  const key = `${roomId}:${index}`
  const t = sudokuLockTimers.get(key)
  if (t) { clearTimeout(t); sudokuLockTimers.delete(key) }
}

function _clearRoomSudokuLockTimers(roomId) {
  for (const key of [...sudokuLockTimers.keys()]) {
    if (key.startsWith(`${roomId}:`)) { clearTimeout(sudokuLockTimers.get(key)); sudokuLockTimers.delete(key) }
  }
}

function _scheduleSudokuLockRelease(io, roomId, index, ownerId) {
  _clearSudokuLockTimer(roomId, index)
  const key = `${roomId}:${index}`
  const t = setTimeout(async () => {
    sudokuLockTimers.delete(key)
    const room = await roomManager.get(roomId)
    if (!room || room.mode !== 'SUDOKU') return
    const lock = room.match?.editLock?.[index]
    if (lock && lock.by === ownerId) {
      await roomManager.update(roomId, r => { delete r.match.editLock[index] })
      io.to(roomId).emit('sudoku:unlock', { index })
    }
  }, SUDOKU_LOCK_TTL)
  sudokuLockTimers.set(key, t)
}

export function registerMatchHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id

  // ── Player ready → when both are ready, start the match ───────────────────
  socket.on('match:ready', async ({ roomId } = {}, ack) => {
    try {
      if (typeof roomId !== 'string') return ack?.({ ok: false, error: 'Invalid room' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (!MATCH_MODES.has(room.mode)) return ack?.({ ok: false, error: 'Wrong mode for match' })
      if (!room.players.find(p => p.id === playerId)) {
        return ack?.({ ok: false, error: 'Not a player in this room' })
      }

      socket.join(roomId)
      await roomManager.update(roomId, r => {
        const p = r.players.find(p => p.id === playerId)
        if (p) p.ready = true
      })

      const updated = await roomManager.get(roomId)
      if (!updated) return ack?.({ ok: false, error: 'Room not found' })
      const bothReady = updated.players.length === 2 && updated.players.every(p => p.ready)
      const inLobby = updated.phase === 'SETUP' || updated.phase === 'LOBBY'

      if (bothReady && inLobby) {
        await _startMatch(io, roomId)
      } else {
        io.to(roomId).emit('room:updated', _roomSummary(updated))
      }
      ack?.({ ok: true })
    } catch (err) {
      logger.error({ err }, 'match:ready error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Party host pressed "Start" (party rooms ≥2 players) ───────────────────
  socket.on('match:host_start', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (!MATCH_MODES.has(room.mode)) return ack?.({ ok: false, error: 'Wrong mode' })
      if (room.hostId !== playerId) return ack?.({ ok: false, error: 'Only the host can start' })
      if (room.players.length < 2) return ack?.({ ok: false, error: 'Need at least 2 players' })
      if (room.phase !== 'LOBBY' && room.phase !== 'SETUP') return ack?.({ ok: false, error: 'Already started' })
      socket.join(roomId)
      await _startMatch(io, roomId)
      ack?.({ ok: true })
    } catch (err) {
      logger.error({ err }, 'match:host_start error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── XOX move ──────────────────────────────────────────────────────────────
  socket.on('xox:move', async ({ roomId, cell } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'XOX' || room.phase !== 'PLAYING') {
        return ack?.({ ok: false, error: 'Match not active' })
      }
      const m = room.match
      if (!m || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      if (!Number.isInteger(cell) || cell < 0 || cell > 8) {
        return ack?.({ ok: false, error: 'Invalid cell' })
      }
      if (m.board[cell] !== null) return ack?.({ ok: false, error: 'Cell occupied' })

      clearTimer(roomId)
      const symbol = m.symbols[playerId]
      let over = false, winnerId = null, draw = false

      await roomManager.update(roomId, r => {
        r.match.board[cell] = symbol
        const w = TicTacToeEngine.winnerOf(r.match.board)
        if (w) {
          over = true; winnerId = playerId; r.match.winnerId = playerId
        } else if (r.match.board.every(c => c !== null)) {
          over = true; draw = true; r.match.draw = true
        } else {
          const opp = r.players.find(p => p.id !== playerId)?.id
          r.match.turnId = opp
        }
      })

      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('xox:update', {
        board:  updated.match.board,
        turnId: updated.match.turnId,
        lastCell: cell,
        by: playerId,
      })
      ack?.({ ok: true })

      if (over) await _endXoxRound(io, roomId, { winnerId, draw })
      else _startMoveTimer(io, roomId, updated.match.turnId)
    } catch (err) {
      logger.error({ err }, 'xox:move error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── SOS: place a letter ─────────────────────────────────────────────────────
  // Forming ≥1 S–O–S keeps your turn and locks the board until you DRAW (claim)
  // each line via sos:claim — scoring happens on the claim, not the placement.
  socket.on('sos:move', async ({ roomId, cell, letter } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SOS' || room.phase !== 'PLAYING') {
        return ack?.({ ok: false, error: 'Match not active' })
      }
      const m = room.match
      if (!m || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      if (m.pending && m.pending.length)  return ack?.({ ok: false, error: 'Draw your S-O-S first' })
      letter = String(letter || '').toUpperCase()
      if (letter !== 'S' && letter !== 'O') return ack?.({ ok: false, error: 'Pick S or O' })
      if (!Number.isInteger(cell) || cell < 0 || cell >= m.board.length || m.board[cell] !== null) {
        return ack?.({ ok: false, error: 'Invalid cell' })
      }

      clearTimer(roomId)
      let pendingCount = 0, over = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        mm.board[cell] = letter
        const formed = SosEngine.linesAt(mm.board, mm.size, cell)
        if (formed.length) {
          mm.pending = formed; mm.pendingBy = playerId   // keep turn → must claim
          pendingCount = formed.length
        } else {
          mm.pending = []; mm.pendingBy = null
          mm.turnId = r.players.find(p => p.id !== playerId)?.id || mm.turnId  // pass
          if (SosEngine.isFull(mm.board)) over = true
        }
      })
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('sos:update', { match: _publicMatch(updated.match), lastCell: cell, by: playerId })
      ack?.({ ok: true, pendingCount })

      if (over) {
        const { winnerId, draw } = _sosResult(updated.match)
        await _endMatch(io, roomId, { winnerId, draw, reason: 'complete' })
      } else {
        _startSosTimer(io, roomId, updated.match.turnId)
      }
    } catch (err) {
      logger.error({ err }, 'sos:move error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── SOS: claim (draw) a completed S–O–S → +1 and a bonus turn ────────────────
  socket.on('sos:claim', async ({ roomId, cells } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SOS' || room.phase !== 'PLAYING') {
        return ack?.({ ok: false, error: 'Match not active' })
      }
      const m = room.match
      if (!m || m.pendingBy !== playerId || !m.pending?.length) {
        return ack?.({ ok: false, error: 'Nothing to claim' })
      }
      if (!Array.isArray(cells) || cells.length !== 3) return ack?.({ ok: false, error: 'Bad claim' })
      const key = [...cells].sort((a, b) => a - b).join(',')

      let claimed = false, over = false, emptied = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        const i = mm.pending.findIndex(t => [...t].sort((a, b) => a - b).join(',') === key)
        if (i === -1) return
        const tri = mm.pending.splice(i, 1)[0]
        mm.lines.push({ cells: tri, by: playerId })
        mm.scores[playerId] = (mm.scores[playerId] || 0) + 1
        claimed = true
        if (mm.pending.length === 0) {
          mm.pendingBy = null; emptied = true
          if (SosEngine.isFull(mm.board)) over = true
        }
      })
      if (!claimed) return ack?.({ ok: false, error: 'Not a pending line' })

      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('sos:claimed', { match: _publicMatch(updated.match), cells, by: playerId })
      ack?.({ ok: true })

      if (over) {
        const { winnerId, draw } = _sosResult(updated.match)
        await _endMatch(io, roomId, { winnerId, draw, reason: 'complete' })
      } else if (emptied) {
        clearTimer(roomId)
        _startSosTimer(io, roomId, updated.match.turnId)   // bonus turn (same player)
      }
    } catch (err) {
      logger.error({ err }, 'sos:claim error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Math Battle answer ────────────────────────────────────────────────────
  socket.on('math:answer', async ({ roomId, index, choice } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'MATH' || room.phase !== 'PLAYING') {
        return ack?.({ ok: false, error: 'Match not active' })
      }
      const m = room.match
      if (!m || m.resolved || index !== m.index) {
        return ack?.({ ok: false, error: 'Already resolved' })
      }

      // First valid answer for this index locks it. The roomManager mutex
      // serialises near-simultaneous answers; we re-check inside the lock.
      let didResolve = false, correct = false, answer = null
      await roomManager.update(roomId, r => {
        const mm = r.match
        if (mm.resolved || index !== mm.index) return
        const q = mm.questions[index]
        correct = Number(choice) === q.answer
        answer  = q.answer
        // correct = +1 to answerer; wrong = −1 to answerer AND +1 to opponent.
        const oppId = r.players.find(p => p.id !== playerId)?.id
        if (correct) {
          mm.scores[playerId] = (mm.scores[playerId] || 0) + 1
        } else {
          mm.scores[playerId] = (mm.scores[playerId] || 0) - 1
          if (oppId) mm.scores[oppId] = (mm.scores[oppId] || 0) + 1
        }
        mm.resolved = true
        didResolve = true
      })
      if (!didResolve) return ack?.({ ok: false, error: 'Already resolved' })

      _clearMathTimer(roomId)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('math:resolved', {
        index, byPlayerId: playerId, correct, answer,
        scores: updated.players.map(p => ({ id: p.id, score: updated.match.scores[p.id] || 0 })),
      })
      ack?.({ ok: true })
      _advanceMath(io, roomId)
    } catch (err) {
      logger.error({ err }, 'math:answer error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Sudoku: claim a transient edit lock on a cell ─────────────────────────
  socket.on('sudoku:lock', async ({ roomId, index } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SUDOKU' || room.phase !== 'PLAYING') return ack?.({ ok: false })
      const m = room.match
      if (!_sudokuEditable(m, index)) return ack?.({ ok: false, error: 'Cell not editable' })

      const now = Date.now()
      const existing = m.editLock[index]
      if (existing && existing.by !== playerId && (now - existing.ts) < SUDOKU_LOCK_TTL) {
        return ack?.({ ok: false, error: 'Cell is being edited' })
      }
      await roomManager.update(roomId, r => { r.match.editLock[index] = { by: playerId, ts: now } })
      io.to(roomId).emit('sudoku:lock', { index, by: playerId })
      _scheduleSudokuLockRelease(io, roomId, index, playerId)  // auto-unlock after 3s
      ack?.({ ok: true })
    } catch (err) { ack?.({ ok: false, error: err.message }) }
  })

  // ── Sudoku: release my edit lock ──────────────────────────────────────────
  socket.on('sudoku:unlock', async ({ roomId, index } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SUDOKU') return ack?.({ ok: false })
      if (room.match.editLock[index]?.by === playerId) {
        _clearSudokuLockTimer(roomId, index)
        await roomManager.update(roomId, r => { delete r.match.editLock[index] })
        io.to(roomId).emit('sudoku:unlock', { index })
      }
      ack?.({ ok: true })
    } catch (err) { ack?.({ ok: false, error: err.message }) }
  })

  // ── Sudoku: fill a cell ───────────────────────────────────────────────────
  socket.on('sudoku:fill', async ({ roomId, index, value } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SUDOKU' || room.phase !== 'PLAYING') return ack?.({ ok: false })
      const m = room.match
      const val = Number(value)
      if (!Number.isInteger(val) || val < 1 || val > 9) return ack?.({ ok: false, error: 'Bad value' })
      if (!_sudokuEditable(m, index)) return ack?.({ ok: false, error: 'Cell not editable' })

      // A player may not fix their OWN wrong cell — only the opponent can.
      if (m.status[index] === 'wrong' && m.wrongOwner[index] === playerId) {
        return ack?.({ ok: false, error: 'Your partner must fix this one' })
      }
      // Cell currently being edited by the other player.
      const now = Date.now()
      const lock = m.editLock[index]
      if (lock && lock.by !== playerId && (now - lock.ts) < SUDOKU_LOCK_TTL) {
        return ack?.({ ok: false, error: 'Cell is being edited' })
      }

      const correct = m.solution[index] === val
      let over = false
      let bustedBy = null   // playerId who hit the mistake limit (forfeits)
      await roomManager.update(roomId, r => {
        const mm = r.match
        const wasWrong = mm.status[index] === 'wrong'
        mm.grid[index] = val
        delete mm.editLock[index]
        if (correct) {
          mm.status[index] = 'correct'
          mm.scores[playerId] = (mm.scores[playerId] || 0) + 1
          mm.correctCount++
          mm.wrongOwner[index] = null
          mm.wrongTs[index] = null
          if (mm.correctCount >= mm.fillTarget) over = true
        } else {
          mm.status[index] = 'wrong'
          mm.scores[playerId] = (mm.scores[playerId] || 0) - 1
          if (!wasWrong) mm.wrongCount++   // count each new wrong attempt
          mm.mistakes[playerId] = (mm.mistakes[playerId] || 0) + 1   // every wrong submit counts
          mm.wrongOwner[index] = playerId
          mm.wrongTs[index] = now
          if (mm.mistakes[playerId] >= mm.mistakeLimit) { over = true; bustedBy = playerId }
        }
      })

      _clearSudokuLockTimer(roomId, index)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('sudoku:update', _sudokuCellUpdate(updated, index, playerId))
      ack?.({ ok: true, correct })

      if (over) {
        const [a, b] = updated.players
        let winnerId, draw
        if (bustedBy) {
          // Hit the mistake cap → instant loss; the other player wins.
          draw = false
          winnerId = updated.players.find(p => p.id !== bustedBy)?.id ?? null
        } else {
          const sa = updated.match.scores[a.id] || 0
          const sb = updated.match.scores[b.id] || 0
          draw = sa === sb
          winnerId = draw ? null : (sa > sb ? a.id : b.id)
        }
        await _endMatch(io, roomId, { winnerId, draw, reason: bustedBy ? 'mistakes' : 'complete' })
      }
    } catch (err) {
      logger.error({ err }, 'sudoku:fill error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Sudoku: clear a wrong cell (cross-fix + safety cooldown) ──────────────
  socket.on('sudoku:clear', async ({ roomId, index } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SUDOKU' || room.phase !== 'PLAYING') return ack?.({ ok: false })
      const m = room.match
      if (m.status[index] !== 'wrong') return ack?.({ ok: false, error: 'Nothing to clear' })

      const now = Date.now()
      const mayClear = m.wrongOwner[index] !== playerId   // the other player can always fix
        || (now - (m.wrongTs[index] || 0)) >= SUDOKU_WRONG_COOLDOWN  // safety after cooldown
      if (!mayClear) return ack?.({ ok: false, error: 'Wait for your partner (or a few seconds)' })

      await roomManager.update(roomId, r => {
        const mm = r.match
        mm.grid[index] = 0
        mm.status[index] = 'empty'
        mm.wrongOwner[index] = null
        mm.wrongTs[index] = null
        delete mm.editLock[index]
      })
      _clearSudokuLockTimer(roomId, index)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('sudoku:update', _sudokuCellUpdate(updated, index, playerId))
      ack?.({ ok: true })
    } catch (err) { ack?.({ ok: false, error: err.message }) }
  })

  // ── Spin Battle: spin the wheel ───────────────────────────────────────────
  socket.on('spin:spin', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Match not active' })
      const m = room.match
      if (!m || m.roundOver || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      if (m.canGuess) return ack?.({ ok: false, error: 'Call a consonant or solve first' })

      const { index, wedge } = spinWheel()
      let effect, passed = false, stealAmount = 0, skipped = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        mm.lastWedge = null
        if (typeof wedge === 'number') { mm.lastWedge = wedge; mm.canGuess = true; effect = 'points' }
        else if (wedge === 'BANKRUPT') {
          if (mm.shield?.[playerId]) { mm.shield[playerId] = false; effect = 'bankrupt_blocked' }
          else { mm.bank[playerId] = 0; effect = 'bankrupt'; passed = true }
        }
        else if (wedge === 'LOSE_TURN') { effect = 'lose_turn'; passed = true }
        else if (wedge === 'EXTRA_TURN') { mm.bank[playerId] = (mm.bank[playerId] || 0) + EXTRA_TURN_BONUS; effect = 'extra_turn' }
        else if (wedge === 'DOUBLE') { mm.bank[playerId] = (mm.bank[playerId] || 0) * 2; effect = 'double' }
        else if (wedge === 'JACKPOT') { mm.bank[playerId] = (mm.bank[playerId] || 0) + JACKPOT_BONUS; effect = 'jackpot' }
        else if (wedge === 'STEAL') { // take from the richest opponent's round bank
          const target = _richestOpponent(mm, r.players, playerId)
          stealAmount = Math.min(STEAL_AMOUNT, target ? (mm.bank[target] || 0) : 0)
          if (target) mm.bank[target] = (mm.bank[target] || 0) - stealAmount
          mm.bank[playerId] = (mm.bank[playerId] || 0) + stealAmount
          effect = 'steal'
        }
        else if (wedge === 'SHIELD') { if (mm.shield) mm.shield[playerId] = true; effect = 'shield' }
        else { mm.frozenId = _nextInOrder(r.players, playerId); effect = 'freeze' } // FREEZE — skip next player's turn
        if (passed) { const nt = _spinNextTurn(mm, r.players, playerId); mm.turnId = nt.turnId; skipped = nt.skipped }
      })
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('spin:update', {
        event: 'spin', by: playerId, index, wedge, effect, passed, stealAmount, skipped,
        match: _publicMatch(updated.match),
      })
      _armSpinTimer(io, roomId, updated.match.turnId)
      ack?.({ ok: true })
    } catch (err) { logger.error({ err }, 'spin:spin error'); ack?.({ ok: false, error: err.message }) }
  })

  // ── Spin Battle: call a consonant ─────────────────────────────────────────
  socket.on('spin:guess', async ({ roomId, letter } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Match not active' })
      const m = room.match
      if (!m || m.roundOver || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      letter = String(letter || '').toUpperCase()
      if (!isConsonant(letter)) return ack?.({ ok: false, error: 'Pick a consonant' })
      if (!m.canGuess || typeof m.lastWedge !== 'number') return ack?.({ ok: false, error: 'Spin first' })
      if (m.revealed.includes(letter)) return ack?.({ ok: false, error: 'Already guessed' })
      if ((m.wrongGuesses?.[playerId] || []).includes(letter)) return ack?.({ ok: false, error: 'You already tried that letter' })

      let correct = false, count = 0, points = 0, roundWon = false, passed = false, skipped = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        count = countOf(mm.answer, letter)
        const wedge = mm.lastWedge
        mm.canGuess = false; mm.lastWedge = null
        if (count > 0) {
          mm.revealed.push(letter)
          points = wedge * count
          mm.bank[playerId] = (mm.bank[playerId] || 0) + points
          correct = true
          if (isAllRevealed(mm.answer, mm.revealed)) roundWon = true
        } else {
          if (mm.wrongGuesses?.[playerId] && !mm.wrongGuesses[playerId].includes(letter)) {
            mm.wrongGuesses[playerId].push(letter)   // private to this player
          }
          const nt = _spinNextTurn(mm, r.players, playerId)
          mm.turnId = nt.turnId; passed = true; skipped = nt.skipped
        }
      })
      ack?.({ ok: true, correct })
      if (roundWon) return _afterSpinRoundWin(io, roomId, playerId)
      const updated = await roomManager.get(roomId)
      // A wrong letter is PRIVATE: opponents see only that the turn passed, while
      // the guesser alone learns which letter missed (kept off the broadcast).
      io.to(roomId).emit('spin:update', {
        event: 'guess', by: playerId, letter: correct ? letter : null, correct, count, points, passed, skipped,
        match: _publicMatch(updated.match),
      })
      if (!correct) socket.emit('spin:wrong', { letter, round: updated.match.round })
      _armSpinTimer(io, roomId, updated.match.turnId)
    } catch (err) { logger.error({ err }, 'spin:guess error'); ack?.({ ok: false, error: err.message }) }
  })

  // ── Spin Battle: buy a vowel ──────────────────────────────────────────────
  socket.on('spin:vowel', async ({ roomId, letter } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Match not active' })
      const m = room.match
      if (!m || m.roundOver || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })
      letter = String(letter || '').toUpperCase()
      if (m.canGuess) return ack?.({ ok: false, error: 'Call a consonant or solve first' })
      if (!isVowel(letter)) return ack?.({ ok: false, error: 'Pick a vowel' })
      if (m.revealed.includes(letter)) return ack?.({ ok: false, error: 'Already revealed' })
      if ((m.bank[playerId] || 0) < m.vowelCost) return ack?.({ ok: false, error: 'Not enough points for a vowel' })

      let correct = false, count = 0, roundWon = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        mm.bank[playerId] = (mm.bank[playerId] || 0) - mm.vowelCost
        mm.lastWedge = null
        count = countOf(mm.answer, letter)
        if (count > 0) {
          mm.revealed.push(letter)
          correct = true
          if (isAllRevealed(mm.answer, mm.revealed)) roundWon = true
        }
      })
      ack?.({ ok: true, correct })
      if (roundWon) return _afterSpinRoundWin(io, roomId, playerId)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('spin:update', {
        event: 'vowel', by: playerId, letter, correct, count,
        match: _publicMatch(updated.match),
      })
      _armSpinTimer(io, roomId, updated.match.turnId)
    } catch (err) { logger.error({ err }, 'spin:vowel error'); ack?.({ ok: false, error: err.message }) }
  })

  // ── Spin Battle: attempt to solve ─────────────────────────────────────────
  socket.on('spin:solve', async ({ roomId, attempt } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Match not active' })
      const m = room.match
      if (!m || m.roundOver || m.turnId !== playerId) return ack?.({ ok: false, error: 'Not your turn' })

      let solved = false, skipped = false
      await roomManager.update(roomId, r => {
        const mm = r.match
        solved = normalizeSolve(attempt) === normalizeSolve(mm.answer)
        if (solved) {
          for (const ch of distinctLetters(mm.answer)) if (!mm.revealed.includes(ch)) mm.revealed.push(ch)
        } else {
          mm.canGuess = false; mm.lastWedge = null
          const nt = _spinNextTurn(mm, r.players, playerId)
          mm.turnId = nt.turnId; skipped = nt.skipped
        }
      })
      ack?.({ ok: true, solved })
      if (solved) return _afterSpinRoundWin(io, roomId, playerId)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('spin:update', {
        event: 'solve', by: playerId, solved: false, passed: true, skipped,
        match: _publicMatch(updated.match),
      })
      _armSpinTimer(io, roomId, updated.match.turnId)
    } catch (err) { logger.error({ err }, 'spin:solve error'); ack?.({ ok: false, error: err.message }) }
  })

  // ── Forfeit (explicit "I give up") ────────────────────────────────────────
  socket.on('match:forfeit', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || !MATCH_MODES.has(room.mode)) return ack?.({ ok: false })
      const winnerId = room.players.find(p => p.id !== playerId)?.id || null
      io.to(roomId).emit('match:forfeit', { forfeitPlayerId: playerId, winnerId })
      await _endMatch(io, roomId, { winnerId, draw: false })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })
}

// ── Match start (mode-specific init) ──────────────────────────────────────────
async function _startMatch(io, roomId) {
  const room = await roomManager.get(roomId)
  if (!room) return

  if (room.mode === 'XOX') {
    const [a, b] = room.players
    // Alternate who is X (and therefore moves first) every game/rematch.
    const seq = room.gameSeq || 0
    const xId = seq % 2 === 0 ? a.id : b.id
    const oId = seq % 2 === 0 ? b.id : a.id
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.gameSeq = seq + 1
      r.match = {
        kind:    'XOX',
        board:   Array(9).fill(null),
        symbols: { [xId]: 'X', [oId]: 'O' },  // X moves first; swaps each game
        turnId:  xId,
        winnerId: null,
        draw:    false,
        // Best-of-3 series: first to 2 game-wins takes the match; draws replay.
        series:  { [a.id]: 0, [b.id]: 0 },
        roundsToWin: 2,
        gameNo:  1,
      }
    })
  }
  if (room.mode === 'MATH') {
    const [a, b] = room.players
    // Generate with the engine, then store PLAIN data (questions incl. answers)
    // so the room is fully JSON-serialisable (for Redis persistence).
    const engine = new MathBattleEngine({ difficulty: room.difficulty || 'medium', count: 20 })
    const questions = engine.questions
    const total = engine.total
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.match = {
        kind:     'MATH',
        questions,                    // [{ prompt, options, answer }] — server-only answers
        index:    0,
        total,
        scores:   { [a.id]: 0, [b.id]: 0 },
        resolved: false,
        question: _publicQuestion(questions, 0, total),
      }
    })
  }
  if (room.mode === 'SUDOKU') {
    const [a, b] = room.players
    const engine = new SudokuEngine({ difficulty: room.difficulty || 'medium' })
    const given  = engine.puzzle.map(v => v !== 0)
    const status = engine.puzzle.map(v => (v !== 0 ? 'given' : 'empty'))
    const fillTarget = given.filter(g => !g).length
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.match = {
        kind:       'SUDOKU',
        solution:   engine.solution,         // server-only; never sent to clients
        grid:       [...engine.puzzle],
        given,
        status,
        wrongOwner: Array(81).fill(null),
        wrongTs:    Array(81).fill(null),
        editLock:   {},                      // index -> { by, ts }
        scores:     { [a.id]: 0, [b.id]: 0 },
        mistakes:   { [a.id]: 0, [b.id]: 0 },   // cumulative — never decremented
        mistakeLimit: SUDOKU_MISTAKE_LIMIT[room.difficulty] ?? SUDOKU_MISTAKE_LIMIT.medium,
        correctCount: 0,
        wrongCount:   0,
        fillTarget,
      }
    })
  }

  if (room.mode === 'SPIN') {
    // Generalised to N players (2–8). Turn rotates through the player list; the
    // starting player rotates each match/rematch.
    const ids = room.players.map(p => p.id)
    const seq = room.gameSeq || 0
    const firstId = ids[seq % ids.length]
    const picked = pickPuzzle(room.difficulty || 'medium')
    const zero = () => Object.fromEntries(ids.map(id => [id, 0]))
    const falses = () => Object.fromEntries(ids.map(id => [id, false]))
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.gameSeq = seq + 1
      r.match = {
        kind:      'SPIN',
        answer:    picked.text,           // server-only
        category:  picked.category,
        revealed:  [],
        wrongGuesses: Object.fromEntries(ids.map(id => [id, []])),  // private per-player wrong consonants
        wheel:     [...WHEEL],
        vowelCost: VOWEL_COST,
        bank:      zero(),
        roundWins: zero(),
        shield:    falses(),
        frozenId:  null,
        nextRoundAt: null,         // server deadline for the visible round countdown
        round:     1,
        bestOf:    SPIN_BEST_OF,
        roundsToWin: r.players.length === 2 ? 2 : 2,  // first to 2 round wins
        turnId:    firstId,
        canGuess:  false,
        lastWedge: null,
        roundOver: false,
      }
    })
  }

  if (room.mode === 'SOS') {
    // Turn rotates through the player list; the starting player rotates each game.
    const ids = room.players.map(p => p.id)
    const seq = room.gameSeq || 0
    const firstId = ids[seq % ids.length]
    const size = Number(room.difficulty) === 10 ? 10 : 8
    await roomManager.update(roomId, r => {
      r.phase = 'PLAYING'
      r.winnerId = null
      r.gameSeq = seq + 1
      r.match = {
        kind:    'SOS',
        size,
        board:   Array(size * size).fill(null),
        turnId:  firstId,
        scores:  Object.fromEntries(ids.map(id => [id, 0])),
        lines:   [],          // [{ cells:[i,i,i], by: playerId }] — claimed SOS
        pending: [],          // SOS the current mover has formed but not yet drawn
        pendingBy: null,
      }
    })
  }

  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const s = _findSocket(io, p.id)
    s?.emit('match:start', _matchView(updated, p.id))
  }

  if (updated.mode === 'XOX')  _startMoveTimer(io, roomId, updated.match.turnId)
  if (updated.mode === 'MATH') _startQuestionTimer(io, roomId)
  if (updated.mode === 'SPIN') _armSpinTimer(io, roomId, updated.match.turnId)
  if (updated.mode === 'SOS')  _startSosTimer(io, roomId, updated.match.turnId)
}

function _nextInOrder(players, fromId) {
  const ids = players.map(p => p.id)
  if (ids.length < 2) return null
  const i = ids.indexOf(fromId)
  return ids[(i + 1) % ids.length]
}

function _richestOpponent(mm, players, fromId) {
  let target = null, max = -1
  for (const p of players) {
    if (p.id === fromId) continue
    const b = mm.bank[p.id] || 0
    if (b > max) { max = b; target = p.id }
  }
  return target
}

// Pass the turn to the next player in order (N players), honouring FREEZE: if the
// next player is frozen, consume the freeze and skip them to the following one.
function _spinNextTurn(mm, players, fromId) {
  const ids = players.map(p => p.id)
  if (ids.length < 2) return { turnId: fromId, skipped: false }
  const i = ids.indexOf(fromId)
  let next = ids[(i + 1) % ids.length]
  let skipped = false
  if (mm.frozenId === next) { mm.frozenId = null; skipped = true; next = ids[(i + 2) % ids.length] }
  return { turnId: next, skipped }
}

// Anti-stall: (re)arm the 60s turn timer for whoever's turn it is, and broadcast
// a deadline so BOTH players see an identical visible countdown. If the player
// doesn't act in time they lose the round. Re-armed after every action; the
// stored turnEndsAt also lets a reconnecting client resume the same countdown.
async function _armSpinTimer(io, roomId, turnId) {
  clearTimer(roomId)
  await roomManager.update(roomId, r => { if (r.match) r.match.turnEndsAt = Date.now() + SPIN_TURN_MS })
  io.to(roomId).emit('spin:turn', { turnId, turnCountdownMs: SPIN_TURN_MS })
  getTimer(roomId, async (rid) => {
    const room = await roomManager.get(rid)
    if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return
    const mm = room.match
    if (!mm || mm.roundOver || mm.turnId !== turnId) return
    const winnerId = room.players.find(p => p.id !== turnId)?.id || null
    io.to(rid).emit('match:timeout', { playerId: turnId })
    if (winnerId) await _afterSpinRoundWin(io, rid, winnerId)
  }).start(SPIN_TURN_MS)
}

// ── Spin Battle: round / match progression ─────────────────────────────────
const SPIN_TROPHIES = [30, 15, 5, -10, -10, -10, -10, -10]  // by final rank

async function _afterSpinRoundWin(io, roomId, winnerId) {
  clearTimer(roomId)   // round decided → stop the anti-stall timer
  let matchOver = false
  await roomManager.update(roomId, r => {
    const mm = r.match
    if (!mm || mm.roundOver) return
    mm.roundOver = true
    mm.roundWins[winnerId] = (mm.roundWins[winnerId] || 0) + 1
    if (mm.roundWins[winnerId] >= (mm.roundsToWin || 2)) matchOver = true
    // Arm the visible between-rounds countdown (skip if the match just ended).
    mm.nextRoundAt = matchOver ? null : Date.now() + SPIN_ROUND_COUNTDOWN_MS
  })
  const updated = await roomManager.get(roomId)
  if (!updated?.match) return
  io.to(roomId).emit('spin:update', {
    event: 'roundover', winnerId, matchOver,
    answer: updated.match.answer,                       // reveal it on the banner
    countdownMs: matchOver ? 0 : SPIN_ROUND_COUNTDOWN_MS,
    match: _publicMatch(updated.match),
  })
  if (matchOver) {
    const mm = updated.match
    // Rank by round wins, tiebreak by this round's bank.
    const ranked = [...updated.players].sort((a, b) =>
      (mm.roundWins[b.id] || 0) - (mm.roundWins[a.id] || 0) ||
      (mm.bank[b.id] || 0) - (mm.bank[a.id] || 0))
    const ranking = ranked.map((p, i) => ({
      id: p.id, name: p.name, rank: i + 1,
      roundWins: mm.roundWins[p.id] || 0,
      trophies: SPIN_TROPHIES[i] ?? -10,
    }))
    await _endMatch(io, roomId, { winnerId, draw: false, ranking })
  } else {
    setTimeout(() => _nextSpinRound(io, roomId, winnerId), SPIN_ROUND_COUNTDOWN_MS)
  }
}

async function _nextSpinRound(io, roomId, lastWinnerId) {
  const room = await roomManager.get(roomId)
  if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return
  const picked = pickPuzzle(room.difficulty || 'medium')
  // Rotate the starter — the player after the round winner goes first.
  const firstId = _nextInOrder(room.players, lastWinnerId) || lastWinnerId
  await roomManager.update(roomId, r => {
    const mm = r.match
    mm.answer = picked.text
    mm.category = picked.category
    mm.revealed = []
    for (const p of r.players) { mm.bank[p.id] = 0; if (mm.shield) mm.shield[p.id] = false }
    mm.frozenId = null
    mm.nextRoundAt = null
    for (const p of r.players) { if (mm.wrongGuesses) mm.wrongGuesses[p.id] = [] }  // fresh round → clear private misses
    mm.turnId = firstId
    mm.canGuess = false
    mm.lastWedge = null
    mm.roundOver = false
    mm.round = (mm.round || 1) + 1
  })
  const updated = await roomManager.get(roomId)
  io.to(roomId).emit('spin:round', { round: updated.match.round, match: _publicMatch(updated.match) })
  _armSpinTimer(io, roomId, updated.match.turnId)
}

// Build a client-safe question (no answer) from the stored questions array.
function _publicQuestion(questions, i, total) {
  const q = questions[i]
  if (!q) return null
  return { index: i, prompt: q.prompt, options: q.options, total }
}

// Advance Math Battle to the next question (after a brief reveal pause), or end.
async function _advanceMath(io, roomId) {
  _clearMathTimer(roomId)
  await new Promise(res => setTimeout(res, MATH_REVEAL_MS))
  const room = await roomManager.get(roomId)
  if (!room || room.mode !== 'MATH' || room.phase !== 'PLAYING') return

  let over = false
  await roomManager.update(roomId, r => {
    const mm = r.match
    mm.index++
    mm.resolved = false
    if (mm.index >= mm.total) over = true
    else mm.question = _publicQuestion(mm.questions, mm.index, mm.total)
  })

  const updated = await roomManager.get(roomId)
  if (over) {
    const [a, b] = updated.players
    const sa = updated.match.scores[a.id] || 0
    const sb = updated.match.scores[b.id] || 0
    const draw = sa === sb
    const winnerId = draw ? null : (sa > sb ? a.id : b.id)
    await _endMatch(io, roomId, { winnerId, draw })
  } else {
    io.to(roomId).emit('math:question', {
      ...updated.match.question,
      scores: updated.players.map(p => ({ id: p.id, score: updated.match.scores[p.id] || 0 })),
    })
    _startQuestionTimer(io, roomId)
  }
}

// If nobody answers within the window, advance with no score for anyone.
function _startQuestionTimer(io, roomId) {
  _clearMathTimer(roomId)
  const t = setTimeout(async () => {
    const room = await roomManager.get(roomId)
    if (!room || room.mode !== 'MATH' || room.phase !== 'PLAYING') return
    const m = room.match
    if (!m || m.resolved) return
    const answer = m.questions[m.index]?.answer
    await roomManager.update(roomId, r => { r.match.resolved = true })
    io.to(roomId).emit('math:resolved', {
      index: m.index, byPlayerId: null, correct: false, answer, timeout: true,
      scores: room.players.map(p => ({ id: p.id, score: m.scores[p.id] || 0 })),
    })
    _advanceMath(io, roomId)
  }, MATH_QUESTION_MS)
  mathTimers.set(roomId, t)
}

// ── Match end ─────────────────────────────────────────────────────────────────
export async function endMatch(io, roomId, { winnerId = null, draw = false } = {}) {
  return _endMatch(io, roomId, { winnerId, draw })
}

// ── XOX best-of-3 series ────────────────────────────────────────────────────
const XOX_INTERMISSION_MS = 2600

async function _endXoxRound(io, roomId, { winnerId, draw }) {
  clearTimer(roomId)
  let matchOver = false
  await roomManager.update(roomId, r => {
    const mm = r.match
    if (!mm) return
    if (!draw && winnerId) {
      mm.series[winnerId] = (mm.series[winnerId] || 0) + 1
      if (mm.series[winnerId] >= (mm.roundsToWin || 2)) matchOver = true
    }
  })
  const updated = await roomManager.get(roomId)
  const mm = updated?.match
  if (!mm) return
  io.to(roomId).emit('xox:roundover', {
    winnerId: draw ? null : winnerId, draw, matchOver,
    series: mm.series, gameNo: mm.gameNo, board: mm.board,
  })
  if (matchOver) await _finishXoxMatch(io, roomId, winnerId)
  else setTimeout(() => _nextXoxGame(io, roomId), XOX_INTERMISSION_MS)
}

async function _nextXoxGame(io, roomId) {
  const room = await roomManager.get(roomId)
  if (!room || room.mode !== 'XOX' || room.phase !== 'PLAYING') return
  const [a, b] = room.players
  const seq = room.gameSeq || 0
  const xId = seq % 2 === 0 ? a.id : b.id
  const oId = seq % 2 === 0 ? b.id : a.id
  await roomManager.update(roomId, r => {
    r.gameSeq = seq + 1
    const series = r.match.series
    const gameNo = (r.match.gameNo || 1) + 1
    r.match = {
      kind: 'XOX', board: Array(9).fill(null), symbols: { [xId]: 'X', [oId]: 'O' },
      turnId: xId, winnerId: null, draw: false, series, roundsToWin: r.match.roundsToWin || 2, gameNo,
    }
  })
  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const s = _findSocket(io, p.id)
    s?.emit('match:start', _matchView(updated, p.id))
  }
  _startMoveTimer(io, roomId, updated.match.turnId)
}

async function _finishXoxMatch(io, roomId, winnerId) {
  clearTimer(roomId)
  cancelRoomGrace(roomId)
  await roomManager.update(roomId, r => {
    r.phase = 'GAME_OVER'
    r.winnerId = winnerId
    const w = r.players.find(p => p.id === winnerId)
    if (w) w.score = (w.score || 0) + 1
  })
  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const s = _findSocket(io, p.id)
    recordResult({ entrantId: s?.handshake.auth?.userId || p.id, name: p.name, won: p.id === winnerId })
  }
  io.to(roomId).emit('match:over', {
    winnerId, draw: false,
    series: updated.match?.series || null,
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })
}

async function _endMatch(io, roomId, { winnerId = null, draw = false, ranking = null, reason = null }) {
  clearTimer(roomId)
  _clearMathTimer(roomId)
  _clearRoomSudokuLockTimers(roomId)
  cancelRoomGrace(roomId) // game finished → don't let a late disconnect override it
  await roomManager.update(roomId, r => {
    r.phase = 'GAME_OVER'
    r.winnerId = winnerId
    if (winnerId) {
      const w = r.players.find(p => p.id === winnerId)
      if (w) w.score = (w.score || 0) + 1
    }
  })
  const updated = await roomManager.get(roomId)
  // Monthly multiplayer leaderboard (server-authoritative).
  for (const p of updated.players) {
    const s = _findSocket(io, p.id)
    recordResult({ entrantId: s?.handshake.auth?.userId || p.id, name: p.name, won: p.id === winnerId })
  }
  io.to(roomId).emit('match:over', {
    winnerId,
    draw,
    ranking,   // N-player Spin Battle: [{ id, name, rank, roundWins, trophies }] or null
    reason,    // e.g. 'mistakes' (Sudoku mistake-limit forfeit) | 'complete' | null
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })
}

// A player left/disconnected from a party room mid-game — keep the match going.
export async function onPartyPlayerLeft(io, roomId, leftId) {
  const room = await roomManager.get(roomId)
  if (!room || room.mode !== 'SPIN' || room.phase !== 'PLAYING') return
  const mm = room.match
  if (!mm) return
  // Drop below 2 → end the match (last player standing wins).
  if (room.players.length < 2) {
    return _endMatch(io, roomId, { winnerId: room.players[0]?.id || null, draw: false })
  }
  // If it was the leaver's turn, hand it to the next present player.
  if (mm.turnId === leftId) {
    await roomManager.update(roomId, r => {
      r.match.canGuess = false; r.match.lastWedge = null
      if (r.match.frozenId === leftId) r.match.frozenId = null
      r.match.turnId = r.players[0]?.id || r.match.turnId
    })
    const updated = await roomManager.get(roomId)
    io.to(roomId).emit('spin:update', { event: 'spin', by: leftId, effect: 'lose_turn', passed: true, match: _publicMatch(updated.match) })
    _armSpinTimer(io, roomId, updated.match.turnId)
  }
}

// ── Per-turn timer (anti-stall) ────────────────────────────────────────────────
function _startMoveTimer(io, roomId, currentTurnId) {
  const timer = getTimer(roomId, async (rid) => {
    const room = await roomManager.get(rid)
    if (!room || room.phase !== 'PLAYING') return
    // The stalling player loses their turn → opponent wins.
    const winnerId = room.players.find(p => p.id !== currentTurnId)?.id || null
    io.to(rid).emit('match:timeout', { playerId: currentTurnId })
    await _endMatch(io, rid, { winnerId, draw: false })
  })
  timer.start()
  io.to(roomId).emit('match:turn', { turnId: currentTurnId, timerMs: 30_000 })
}

// SOS winner from the per-game SOS-point tally (tie → draw).
function _sosResult(match) {
  const ids = Object.keys(match.scores || {})
  const [a, b] = ids
  const sa = match.scores[a] || 0, sb = match.scores[b] || 0
  if (sa === sb) return { winnerId: null, draw: true }
  return { winnerId: sa > sb ? a : b, draw: false }
}

// SOS per-turn timer: on expiry, auto-claim any lines the stalling player is
// owed (must-draw means they earned them), then pass the turn — never forfeit.
function _startSosTimer(io, roomId, currentTurnId) {
  const timer = getTimer(roomId, async (rid) => {
    const room = await roomManager.get(rid)
    if (!room || room.mode !== 'SOS' || room.phase !== 'PLAYING') return
    if (room.match?.turnId !== currentTurnId) return
    let over = false
    await roomManager.update(rid, r => {
      const mm = r.match
      if (mm.pendingBy === currentTurnId && mm.pending.length) {
        for (const cells of mm.pending) {
          mm.lines.push({ cells, by: currentTurnId })
          mm.scores[currentTurnId] = (mm.scores[currentTurnId] || 0) + 1
        }
      }
      mm.pending = []; mm.pendingBy = null
      mm.turnId = r.players.find(p => p.id !== currentTurnId)?.id || mm.turnId
      if (SosEngine.isFull(mm.board)) over = true
    })
    const updated = await roomManager.get(rid)
    io.to(rid).emit('sos:update', { match: _publicMatch(updated.match), lastCell: null, by: currentTurnId, timedOut: true })
    if (over) {
      const { winnerId, draw } = _sosResult(updated.match)
      await _endMatch(io, rid, { winnerId, draw, reason: 'complete' })
    } else {
      _startSosTimer(io, rid, updated.match.turnId)
    }
  })
  timer.start(SOS_TURN_MS)
  io.to(roomId).emit('match:turn', { turnId: currentTurnId, timerMs: SOS_TURN_MS })
}

// ── Views ──────────────────────────────────────────────────────────────────
// XOX has no hidden info, but SPIN carries per-viewer private state (a player's
// own wrong letters) + a live round countdown, so the view is built per viewer.
function _matchView(room, viewerId) {
  const match = _publicMatch(room.match)
  if (match?.kind === 'SPIN') {
    match.myWrongLetters = room.match.wrongGuesses?.[viewerId] || []
    match.countdownMs = _spinCountdownMs(room.match)
    match.turnCountdownMs = room.match.turnEndsAt ? Math.max(0, room.match.turnEndsAt - Date.now()) : 0
  }
  return { room: _roomSummary(room), match, you: viewerId }
}

// Remaining ms on the between-rounds countdown (0 when none is active). Computed
// from the server deadline so every client ticks down from a trusted value.
function _spinCountdownMs(match) {
  if (!match?.nextRoundAt) return 0
  return Math.max(0, match.nextRoundAt - Date.now())
}

function _publicMatch(match) {
  if (!match) return null
  if (match.kind === 'XOX') {
    return {
      kind: 'XOX',
      board: match.board,
      symbols: match.symbols,
      turnId: match.turnId,
      winnerId: match.winnerId,
      draw: match.draw,
      series: match.series || null,
      gameNo: match.gameNo || 1,
      roundsToWin: match.roundsToWin || 2,
    }
  }
  if (match.kind === 'MATH') {
    // Strip the engine (and its answers) — clients only ever see the question.
    return {
      kind:     'MATH',
      index:    match.index,
      total:    match.total,
      scores:   match.scores,
      question: match.question,
      resolved: match.resolved,
    }
  }
  if (match.kind === 'SPIN') {
    // Strip the answer (reveal it only once the round is decided).
    return {
      kind:      'SPIN',
      masked:    maskAnswer(match.answer, match.revealed),
      category:  match.category,
      revealed:  match.revealed,
      wheel:     match.wheel,
      vowelCost: match.vowelCost,
      bank:      match.bank,
      roundWins: match.roundWins,
      shield:    match.shield,
      frozenId:  match.frozenId,
      round:     match.round,
      bestOf:    match.bestOf,
      roundsToWin: match.roundsToWin || 2,
      turnId:    match.turnId,
      canGuess:  match.canGuess,
      lastWedge: match.lastWedge,
      roundOver: match.roundOver,
      ...(match.roundOver ? { answer: match.answer } : {}),
    }
  }
  if (match.kind === 'SUDOKU') {
    // Strip the engine/solution. editLock is flattened to { index: ownerId }.
    const editLock = {}
    for (const [idx, l] of Object.entries(match.editLock || {})) editLock[idx] = l.by
    return {
      kind:         'SUDOKU',
      grid:         match.grid,
      given:        match.given,
      status:       match.status,
      wrongOwner:   match.wrongOwner,
      editLock,
      scores:       match.scores,
      mistakes:     match.mistakes,
      mistakeLimit: match.mistakeLimit,
      correctCount: match.correctCount,
      wrongCount:   match.wrongCount,
      fillTarget:   match.fillTarget,
    }
  }
  if (match.kind === 'SOS') {
    // No hidden info — the whole board, scores and claimed/pending lines are public.
    return {
      kind:      'SOS',
      size:      match.size,
      board:     match.board,
      turnId:    match.turnId,
      scores:    match.scores,
      lines:     match.lines || [],
      pending:   match.pending || [],
      pendingBy: match.pendingBy || null,
    }
  }
  return match
}

// ── Sudoku helpers ─────────────────────────────────────────────────────────
function _sudokuEditable(m, index) {
  if (!m || !Number.isInteger(index) || index < 0 || index > 80) return false
  if (m.given[index]) return false
  if (m.status[index] === 'correct') return false
  return true
}

function _sudokuCellUpdate(room, index, by) {
  const m = room.match
  return {
    index,
    value:        m.grid[index],
    status:       m.status[index],
    wrongOwner:   m.wrongOwner[index],
    by,
    scores:       room.players.map(p => ({ id: p.id, score: m.scores[p.id] || 0 })),
    mistakes:     m.mistakes,
    mistakeLimit: m.mistakeLimit,
    correctCount: m.correctCount,
    wrongCount:   m.wrongCount,
  }
}

function _roomSummary(room) {
  return {
    id: room.id, code: room.code, mode: room.mode, difficulty: room.difficulty,
    phase: room.phase,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, score: p.score })),
    hostId: room.hostId,
    spectatorCount: room.spectators?.length || 0,
  }
}

function _findSocket(io, targetPlayerId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.handshake.auth?.playerId === targetPlayerId) return s
  }
  return null
}

// Exposed so roomHandlers' reconnect can rebuild the public match view.
export function publicMatchFor(room) {
  return _publicMatch(room?.match)
}
