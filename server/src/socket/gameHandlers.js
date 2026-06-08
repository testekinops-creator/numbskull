import { roomManager } from '../game/RoomManager.js'
import { getRoastMessage } from '../game/personality.js'
import { getTimer, clearTimer } from '../game/TurnTimer.js'
import { cancelRoomGrace } from './roomHandlers.js'
import { recordResult } from '../game/MonthlyLeaderboard.js'
import { logger } from '../utils/logger.js'

export function registerGameHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id

  // ── Player ready (sets secret for B&C, marks ready for GTN) ──────────────
  socket.on('game:ready', async ({ roomId, secret } = {}, ack) => {
    try {
      if (typeof roomId !== 'string') return ack?.({ ok: false, error: 'Invalid room' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.phase !== 'SETUP') return ack?.({ ok: false, error: 'Room not in setup phase' })
      // Security: only an actual player of this room may set a secret
      if (!room.players.find(p => p.id === playerId)) {
        return ack?.({ ok: false, error: 'Not a player in this room' })
      }

      // Validate the manually-entered secret for both GTN and BC
      if (room.mode === 'GTN') {
        const n = parseInt(secret, 10)
        if (!secret || isNaN(n) || n < 1 || n > 1000) {
          return ack?.({ ok: false, error: 'Secret must be a number between 1 and 1000' })
        }
      }
      if (room.mode === 'BC') {
        // 6 digits, duplicates allowed
        if (!/^\d{6}$/.test(String(secret))) {
          return ack?.({ ok: false, error: 'Invalid secret: must be 6 digits (0-9)' })
        }
      }

      await roomManager.update(roomId, r => {
        const p = r.players.find(p => p.id === playerId)
        if (p) p.ready = true
        if (!r.round) {
          r.round = { number: 1, phase: 'SETUP', secrets: {}, guesses: [], timerStart: null }
        }
        // Store the player's chosen secret (GTN and BC both set manually)
        if (secret) {
          r.round.secrets[playerId] = String(secret)
        }
      })

      const updated = await roomManager.get(roomId)
      const allReady = updated.players.every(p => p.ready)

      if (allReady && updated.players.length === 2) {
        await _startRound(io, roomId, updated)
      } else {
        io.to(roomId).emit('room:updated', _sanitizeForRoom(updated))
        ack?.({ ok: true })
      }
    } catch (err) {
      logger.error({ err }, 'game:ready error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Submit guess ──────────────────────────────────────────────────────────
  socket.on('game:guess', async ({ roomId, guess } = {}, ack) => {
    try {
      if (typeof roomId !== 'string') return ack?.({ ok: false, error: 'Invalid room' })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Game not active' })
      if (!room.round || room.round.turnId !== playerId) {
        return ack?.({ ok: false, error: 'Not your turn' })
      }

      const opponentId = room.players.find(p => p.id !== playerId)?.id
      const opponentSecret = room.round.secrets[opponentId]
      if (!opponentSecret) return ack?.({ ok: false, error: 'Opponent secret not set' })

      let result
      if (room.mode === 'GTN') {
        // Server-side validation — never trust the client
        const n = parseInt(guess, 10)
        if (!Number.isInteger(n) || n < 1 || n > 1000) {
          return ack?.({ ok: false, error: 'Guess must be a number between 1 and 1000' })
        }
        const { GuessTheNumberEngine } = await import('../game/engines/GuessTheNumberEngine.js')
        const tempEngine = new GuessTheNumberEngine({ difficulty: room.difficulty, range: 1000 })
        tempEngine.secret = parseInt(opponentSecret, 10)
        result = tempEngine.evaluate(n)
      } else {
        // Server-side validation: 6 digits, duplicates allowed
        const g = String(guess).trim()
        if (!/^\d{6}$/.test(g)) {
          return ack?.({ ok: false, error: 'Guess must be 6 digits (0-9)' })
        }
        const { BullsCowsEngine } = await import('../game/engines/BullsCowsEngine.js')
        const scored = BullsCowsEngine.score(g, opponentSecret)
        const correct = scored.bulls === 6
        result = { valid: true, correct, bulls: scored.bulls, cows: scored.cows, positions: scored.positions, guess: g, over: correct }
        guess = g
      }

      if (!result.valid) return ack?.({ ok: false, error: result.error })

      clearTimer(roomId)

      const guessEntry = { playerId, guess, result, ts: Date.now() }
      await roomManager.update(roomId, r => {
        r.round.guesses.push(guessEntry)
        if (result.correct || result.over) {
          r.round.phase = 'ROUND_OVER'
        }
        r.round.turnId = result.correct ? null : opponentId
      })

      const totalGames = room.players.find(p => p.id === playerId)?.totalGames || 0
      const event = result.correct ? (room.mode === 'BC' ? 'win_bc' : 'correct') : (room.mode === 'GTN' ? (result.direction === 'higher' ? 'wrong_low' : 'wrong_high') : 'wrong_low')
      const roast = getRoastMessage(event, totalGames)

      io.to(roomId).emit('game:guess_result', {
        playerId, guess, result, roast: roast.message,
      })

      ack?.({ ok: true, result })

      if (result.correct || result.over) {
        await _endRound(io, roomId, playerId)
      } else {
        _startTurnTimer(io, roomId, opponentId)
      }
    } catch (err) {
      logger.error({ err }, 'game:guess error')
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Rematch request — one player initiates, opponent gets notified ────────
  socket.on('game:rematch_request', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room || room.phase !== 'GAME_OVER') return ack?.({ ok: false, error: 'Invalid state' })

      const myName     = room.players.find(p => p.id === playerId)?.name || 'Opponent'
      const opponentId = room.players.find(p => p.id !== playerId)?.id

      // Make sure THIS socket is still in the room (survives reconnects)
      socket.join(roomId)

      // Broadcast to the whole room — reliable; the client ignores its own id.
      // (Direct socket lookup was flaky when a socket was stale/reconnecting.)
      io.to(roomId).emit('game:rematch_incoming', {
        fromPlayerId: playerId,
        fromPlayerName: myName,
        roomId,
      })

      // Belt-and-suspenders: also emit directly to the opponent socket if found
      const opponentSocket = opponentId ? _getSocketForPlayer(io, opponentId) : null
      if (opponentSocket) {
        opponentSocket.join(roomId)
        opponentSocket.emit('game:rematch_incoming', {
          fromPlayerId: playerId,
          fromPlayerName: myName,
          roomId,
        })
      }

      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Rematch accept — responder says Yes → restart game ────────────────────
  socket.on('game:rematch_accept', async ({ roomId } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })

      await roomManager.update(roomId, r => {
        r.phase = 'SETUP'
        r.round = null
        r.match = null   // also reset new-mode (XOX/MATH/SUDOKU) state
        r.winnerId = null
        r.players.forEach(p => { p.ready = false; p.score = 0 })   // fresh series
      })
      const fresh = await roomManager.get(roomId)
      io.to(roomId).emit('game:rematch_start', _sanitizeForRoom(fresh))
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Rematch decline — responder says No → close room, both go home ────────
  socket.on('game:rematch_decline', async ({ roomId } = {}, ack) => {
    try {
      io.to(roomId).emit('game:rematch_declined', { byPlayerId: playerId })
      clearTimer(roomId)
      await roomManager.delete(roomId)
      io.to(roomId).emit('room:closed', { roomId })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Forfeit (player leaves mid-game) ─────────────────────────────────────
  socket.on('game:forfeit', async ({ roomId } = {}, ack) => {
    await _handleForfeit(io, roomId, playerId)
    ack?.({ ok: true })
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _startRound(io, roomId, room) {
  // Alternate who guesses first every game/rematch (was random → could repeat).
  const seq = room.gameSeq || 0
  const firstPlayerId = room.players[seq % 2].id

  // Both GTN and BC: secrets are already set by players in game:ready
  // No auto-generation — each player manually chose what their opponent guesses
  await roomManager.update(roomId, r => {
    r.round.phase = 'PLAYING'
    r.round.turnId = firstPlayerId
    r.round.timerStart = Date.now()
    r.phase = 'PLAYING'
    r.gameSeq = seq + 1
  })

  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const playerSocket = _getSocketForPlayer(io, p.id)
    playerSocket?.emit('game:start', _sanitizeForPlayer(updated, p.id))
  }

  _startTurnTimer(io, roomId, firstPlayerId)
}

const SERIES_ROUNDS_TO_WIN = 2     // best of 3
const SERIES_PAUSE_MS = 3500       // read the round result before the next round

// End a round. The series runs to 2 round-wins (best of 3): a non-deciding round
// auto-returns to SETUP (re-enter secrets) keeping the running score; the match
// only ends — recording the leaderboard once — when someone reaches 2 (or on a
// forfeit/timeout, via forceEnd).
async function _endRound(io, roomId, winnerId, { forceEnd = false } = {}) {
  clearTimer(roomId)
  // G3: round ended → cancel any pending disconnect-grace so it can't fire
  // an "opponent left" after the game already finished.
  cancelRoomGrace(roomId)
  let matchOver = forceEnd
  await roomManager.update(roomId, r => {
    r.phase = 'GAME_OVER'
    r.winnerId = winnerId
    const winner = r.players.find(p => p.id === winnerId)
    if (winner) winner.score = (winner.score || 0) + 1
    if ((winner?.score || 0) >= SERIES_ROUNDS_TO_WIN) matchOver = true
  })
  const updated = await roomManager.get(roomId)

  if (matchOver) {
    // Monthly multiplayer leaderboard — recorded once per match (series).
    for (const p of updated.players) {
      const s = _getSocketForPlayer(io, p.id)
      recordResult({ entrantId: s?.handshake.auth?.userId || p.id, name: p.name, won: p.id === winnerId })
    }
  }

  io.to(roomId).emit('game:round_over', {
    winnerId,
    matchOver,
    roundsToWin: SERIES_ROUNDS_TO_WIN,
    // Reveal both secrets so the loser learns the number/code they couldn't crack.
    secrets: { ...(updated.round?.secrets || {}) },
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })

  if (!matchOver) setTimeout(() => _nextGuessRound(io, roomId), SERIES_PAUSE_MS)
}

// Series continues → reset to SETUP for the next round, keeping the score.
async function _nextGuessRound(io, roomId) {
  const room = await roomManager.get(roomId)
  if (!room || room.phase !== 'GAME_OVER') return   // ended/closed in the meantime
  await roomManager.update(roomId, r => {
    r.phase = 'SETUP'
    r.round = null
    r.winnerId = null
    r.players.forEach(p => { p.ready = false })   // keep p.score (series total)
  })
  const fresh = await roomManager.get(roomId)
  io.to(roomId).emit('game:rematch_start', _sanitizeForRoom(fresh))
}

async function _handleForfeit(io, roomId, forfeitId) {
  clearTimer(roomId)
  const room = await roomManager.get(roomId)
  if (!room) return
  const winnerId = room.players.find(p => p.id !== forfeitId)?.id
  io.to(roomId).emit('game:forfeit', { forfeitPlayerId: forfeitId, winnerId })
  await _endRound(io, roomId, winnerId, { forceEnd: true })   // a forfeit ends the whole match
}

function _startTurnTimer(io, roomId, currentTurnId) {
  const timer = getTimer(roomId, async (rid) => {
    logger.debug({ roomId: rid }, 'Turn timer expired')
    io.to(rid).emit('game:turn_timeout', { playerId: currentTurnId })
    await _handleForfeit(io, rid, currentTurnId)
  })
  timer.start()
  io.to(roomId).emit('game:turn', { playerId: currentTurnId, timerMs: 30_000 })
}

function _getSocketForPlayer(io, playerId) {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.handshake.auth?.playerId === playerId) return socket
  }
  return null
}

function _sanitizeForRoom(room) {
  return {
    id: room.id, code: room.code, mode: room.mode,
    phase: room.phase, players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready, score: p.score })),
    spectatorCount: room.spectators?.length || 0,
  }
}

function _sanitizeForPlayer(room, playerId) {
  const opponentId = room.players.find(p => p.id !== playerId)?.id
  return {
    ..._sanitizeForRoom(room),
    mySecret: room.round?.secrets?.[playerId] || null,
    turnId: room.round?.turnId || null,
    timerMs: 30_000,
  }
}
