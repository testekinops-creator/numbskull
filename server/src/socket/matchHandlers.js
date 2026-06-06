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
import { recordResult } from '../game/MonthlyLeaderboard.js'
import { logger } from '../utils/logger.js'

export const MATCH_MODES = new Set(['XOX', 'MATH', 'SUDOKU'])

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

      if (over) await _endMatch(io, roomId, { winnerId, draw })
      else _startMoveTimer(io, roomId, updated.match.turnId)
    } catch (err) {
      logger.error({ err }, 'xox:move error')
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
          mm.wrongOwner[index] = playerId
          mm.wrongTs[index] = now
        }
      })

      _clearSudokuLockTimer(roomId, index)
      const updated = await roomManager.get(roomId)
      io.to(roomId).emit('sudoku:update', _sudokuCellUpdate(updated, index, playerId))
      ack?.({ ok: true, correct })

      if (over) {
        const [a, b] = updated.players
        const sa = updated.match.scores[a.id] || 0
        const sb = updated.match.scores[b.id] || 0
        const draw = sa === sb
        const winnerId = draw ? null : (sa > sb ? a.id : b.id)
        await _endMatch(io, roomId, { winnerId, draw })
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
        correctCount: 0,
        wrongCount:   0,
        fillTarget,
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

async function _endMatch(io, roomId, { winnerId = null, draw = false }) {
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
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })
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

// ── Views (no hidden info for XOX, so a single broadcast view is fine) ─────────
function _matchView(room, viewerId) {
  return {
    room:  _roomSummary(room),
    match: _publicMatch(room.match),
    you:   viewerId,
  }
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
      correctCount: match.correctCount,
      wrongCount:   match.wrongCount,
      fillTarget:   match.fillTarget,
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
