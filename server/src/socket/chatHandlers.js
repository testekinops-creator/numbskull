import { roomManager } from '../game/RoomManager.js'

const MAX_TEXT = 200
// Whitelist of allowed quick-emojis (prevents arbitrary payloads)
const ALLOWED_EMOJI = new Set([
  '😂', '😈', '💀', '🔥', '👑', '🤡', '😭', '🥶', '🧠', '💩',
  '👏', '🎯', '😱', '🫡', '💪', '🤝', '👀', '🐂', '🐄', '⚡',
  '😎', '🤣', '😏', '🥳', '😤', '🙄', '😴', '🤔', '🤯', '😬',
  '🫠', '🤓', '😅', '🫣', '🙃', '😇', '🤪', '😜', '🫶', '✨',
  '💯', '🎉', '🥲', '😐', '🤝', '🧊', '🐐', '🤌', '🫵', '🤖',
])

export function registerChatHandlers(io, socket) {
  const auth       = socket.handshake.auth
  const playerId   = auth.playerId || socket.id
  const playerName = auth.playerName || 'Player'

  // ── Text / roast message ─────────────────────────────────────────────────
  socket.on('chat:message', async ({ roomId, text } = {}, ack) => {
    try {
      if (!roomId || typeof text !== 'string') return ack?.({ ok: false })
      const room = await roomManager.get(roomId)
      if (!room) return ack?.({ ok: false, error: 'Room not found' })

      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean) return ack?.({ ok: false })

      socket.join(roomId)
      io.to(roomId).emit('chat:message', {
        fromPlayerId: playerId,
        fromName: playerName,
        text: clean,
        ts: Date.now(),
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false, error: err.message })
    }
  })

  // ── Emoji burst ──────────────────────────────────────────────────────────
  // Reactions appear ONLY on the opponent's screen — broadcast to the room
  // except the sender (socket.to, not io.to).
  socket.on('chat:emoji', async ({ roomId, emoji } = {}, ack) => {
    try {
      if (!roomId || !ALLOWED_EMOJI.has(emoji)) return ack?.({ ok: false })
      socket.join(roomId)
      socket.to(roomId).emit('chat:emoji', {
        fromPlayerId: playerId,
        emoji,
        ts: Date.now(),
      })
      ack?.({ ok: true })
    } catch (err) {
      ack?.({ ok: false })
    }
  })
}
