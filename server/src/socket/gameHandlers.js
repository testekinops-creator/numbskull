import { roomManager } from '../game/RoomManager.js'
import { engineFactory } from '../game/engineFactory.js'
import { getRoastMessage } from '../game/personality.js'
import { getTimer, clearTimer } from '../game/TurnTimer.js'
import { logger } from '../utils/logger.js'

export function registerGameHandlers(io, socket) {
  const auth = socket.handshake.auth
  const playerId = auth.playerId || socket.id

  // ── Player ready (sets secret for B&C, marks ready for GTN) ──────────────
  socket.on('game:ready', async ({ roomId, secret } = {}, ack) => {
    try {
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.phase !== 'SETUP') return ack?.({ ok: false, error: 'Room not in setup phase' })

      // Validate the manually-entered secret for both GTN and BC
      if (room.mode === 'GTN') {
        const n = parseInt(secret, 10)
        const range = room.range || 100
        if (!secret || isNaN(n) || n < 1 || n > range) {
          return ack?.({ ok: false, error: `Secret must be a number between 1 and ${range}` })
        }
      }
      if (room.mode === 'BC') {
        if (!/^\d{4}$/.test(String(secret)) || new Set(String(secret)).size !== 4) {
          return ack?.({ ok: false, error: 'Invalid secret: must be 4 unique digits' })
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
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })
      if (room.phase !== 'PLAYING') return ack?.({ ok: false, error: 'Game not active' })
      if (!room.round || room.round.turnId !== playerId) {
        return ack?.({ ok: false, error: 'Not your turn' })
      }

      const opponentId = room.players.find(p => p.id !== playerId)?.id
      const opponentSecret = room.round.secrets[opponentId]
      const engine = engineFactory(room.mode, {})

      let result
      if (room.mode === 'GTN') {
        const tempEngine = new (await import('../game/engines/GuessTheNumberEngine.js')).GuessTheNumberEngine({
          difficulty: room.difficulty,
          range: 100,
        })
        tempEngine.secret = parseInt(opponentSecret, 10)
        result = tempEngine.evaluate(parseInt(guess, 10))
      } else {
        const { BullsCowsEngine } = await import('../game/engines/BullsCowsEngine.js')
        const scored = BullsCowsEngine.score(String(guess), opponentSecret)
        const correct = scored.bulls === 4
        result = { valid: true, correct, bulls: scored.bulls, cows: scored.cows, positions: scored.positions, guess, over: correct }
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

      const opponentId = room.players.find(p => p.id !== playerId)?.id
      const myName     = room.players.find(p => p.id === playerId)?.name || 'Opponent'

      if (!opponentId) return ack?.({ ok: false, error: 'No opponent in room' })

      // Notify the opponent that this player wants a rematch
      const opponentSocket = _getSocketForPlayer(io, opponentId)
      if (opponentSocket) {
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
        r.players.forEach(p => { p.ready = false })
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
  const firstPlayerId = room.players[Math.floor(Math.random() * 2)].id

  // Both GTN and BC: secrets are already set by players in game:ready
  // No auto-generation — each player manually chose what their opponent guesses
  await roomManager.update(roomId, r => {
    r.round.phase = 'PLAYING'
    r.round.turnId = firstPlayerId
    r.round.timerStart = Date.now()
    r.phase = 'PLAYING'
  })

  const updated = await roomManager.get(roomId)
  for (const p of updated.players) {
    const playerSocket = _getSocketForPlayer(io, p.id)
    playerSocket?.emit('game:start', _sanitizeForPlayer(updated, p.id))
  }

  _startTurnTimer(io, roomId, firstPlayerId)
}

async function _endRound(io, roomId, winnerId) {
  clearTimer(roomId)
  await roomManager.update(roomId, r => {
    r.phase = 'GAME_OVER'
    const winner = r.players.find(p => p.id === winnerId)
    if (winner) winner.score = (winner.score || 0) + 1
  })
  const updated = await roomManager.get(roomId)
  io.to(roomId).emit('game:round_over', {
    winnerId,
    scores: updated.players.map(p => ({ id: p.id, score: p.score })),
  })
}

async function _handleForfeit(io, roomId, forfeitId) {
  clearTimer(roomId)
  const room = await roomManager.get(roomId)
  if (!room) return
  const winnerId = room.players.find(p => p.id !== forfeitId)?.id
  io.to(roomId).emit('game:forfeit', { forfeitPlayerId: forfeitId, winnerId })
  await _endRound(io, roomId, winnerId)
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
