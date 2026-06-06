import { useState, useRef, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext.jsx'

// Public STUN servers for NAT traversal. (A TURN server would improve success
// on symmetric NATs but needs hosting — STUN covers most home/mobile networks.)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// Peer-to-peer voice call over WebRTC, signalled through the room socket.
// callState: 'idle' | 'calling' | 'incoming' | 'connected'
export function useVoiceCall(roomId) {
  const { socket } = useSocket()
  const [callState, setCallState] = useState('idle')
  const [muted, setMuted] = useState(false)
  const [callerName, setCallerName] = useState(null)
  const [error, setError] = useState(null)

  const pcRef          = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)   // attach to an <audio autoPlay/>
  const pendingOffer   = useRef(null)
  const pendingIce     = useRef([])

  const cleanup = useCallback(() => {
    try { pcRef.current?.close() } catch { /* noop */ }
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    pendingOffer.current = null
    pendingIce.current = []
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setMuted(false)
  }, [])

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:ice', { roomId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate })
    }
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0]
        remoteAudioRef.current.play?.().catch(() => {})
      }
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        // leave it to the user/end signal; failures surface as no audio
      }
    }
    pcRef.current = pc
    return pc
  }, [socket, roomId])

  const getMic = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStreamRef.current = stream
    return stream
  }, [])

  // Caller: request mic, build offer, send it.
  const startCall = useCallback(async () => {
    if (!socket) return
    setError(null)
    try {
      const stream = await getMic()
      const pc = createPc()
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { roomId, sdp: offer })
      setCallState('calling')
    } catch (e) {
      cleanup(); setCallState('idle')
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not start call')
    }
  }, [socket, roomId, getMic, createPc, cleanup])

  // Callee: accept the pending offer.
  const acceptCall = useCallback(async () => {
    if (!socket || !pendingOffer.current) return
    setError(null)
    try {
      const stream = await getMic()
      const pc = createPc()
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current))
      for (const c of pendingIce.current) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
      pendingIce.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('call:answer', { roomId, sdp: answer })
      pendingOffer.current = null
      setCallState('connected')
    } catch (e) {
      cleanup(); setCallState('idle'); socket.emit('call:end', { roomId })
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not join call')
    }
  }, [socket, roomId, getMic, createPc, cleanup])

  const declineCall = useCallback(() => {
    socket?.emit('call:decline', { roomId })
    pendingOffer.current = null
    setCallState('idle')
  }, [socket, roomId])

  const endCall = useCallback(() => {
    socket?.emit('call:end', { roomId })
    cleanup()
    setCallState('idle')
  }, [socket, roomId, cleanup])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled) }
  }, [])

  useEffect(() => {
    if (!socket) return

    const onOffer = ({ fromName, sdp }) => {
      pendingOffer.current = sdp
      setCallerName(fromName || 'Opponent')
      setCallState('incoming')
    }
    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      for (const c of pendingIce.current) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
      pendingIce.current = []
      setCallState('connected')
    }
    const onIce = async ({ candidate }) => {
      const pc = pcRef.current
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try { await pc.addIceCandidate(candidate) } catch { /* noop */ }
      } else {
        pendingIce.current.push(candidate)
      }
    }
    const onEnd = () => { cleanup(); setCallState('idle') }
    const onDeclined = () => { cleanup(); setCallState('idle'); setError('Call declined') }

    socket.on('call:offer', onOffer)
    socket.on('call:answer', onAnswer)
    socket.on('call:ice', onIce)
    socket.on('call:end', onEnd)
    socket.on('call:declined', onDeclined)
    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:answer', onAnswer)
      socket.off('call:ice', onIce)
      socket.off('call:end', onEnd)
      socket.off('call:declined', onDeclined)
    }
  }, [socket, cleanup])

  useEffect(() => () => cleanup(), [cleanup])  // end call when leaving the room

  return { callState, muted, callerName, error, remoteAudioRef, startCall, acceptCall, declineCall, endCall, toggleMute }
}
