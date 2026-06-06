// WebRTC voice-call signaling for multiplayer rooms. The server only relays
// SDP offers/answers and ICE candidates between the two players — the audio
// itself is peer-to-peer (with public STUN for NAT traversal). Every relay
// goes to the room EXCEPT the sender (socket.to, not io.to).

export function registerCallHandlers(io, socket) {
  const auth       = socket.handshake.auth
  const playerId   = auth.playerId || socket.id
  const playerName = auth.playerName || 'Player'

  socket.on('call:offer', ({ roomId, sdp } = {}) => {
    if (typeof roomId !== 'string' || !sdp) return
    socket.join(roomId)
    socket.to(roomId).emit('call:offer', { fromPlayerId: playerId, fromName: playerName, sdp })
  })

  socket.on('call:answer', ({ roomId, sdp } = {}) => {
    if (typeof roomId !== 'string' || !sdp) return
    socket.to(roomId).emit('call:answer', { fromPlayerId: playerId, sdp })
  })

  socket.on('call:ice', ({ roomId, candidate } = {}) => {
    if (typeof roomId !== 'string' || !candidate) return
    socket.to(roomId).emit('call:ice', { fromPlayerId: playerId, candidate })
  })

  socket.on('call:end', ({ roomId } = {}) => {
    if (typeof roomId !== 'string') return
    socket.to(roomId).emit('call:end', { fromPlayerId: playerId })
  })

  socket.on('call:decline', ({ roomId } = {}) => {
    if (typeof roomId !== 'string') return
    socket.to(roomId).emit('call:declined', { fromPlayerId: playerId })
  })
}
