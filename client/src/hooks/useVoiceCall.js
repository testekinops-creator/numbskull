import { useState, useRef, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext.jsx'

// ICE servers: STUN locates peers; TURN relays media when a direct path can't
// form (mobile data / symmetric NAT) — without TURN, calls "connect" but stay
// silent for many users. Provide your own TURN via env for production reliability:
//   VITE_TURN_URLS="turn:host:3478,turns:host:5349"  VITE_TURN_USERNAME=... VITE_TURN_CREDENTIAL=...
// Falls back to the free Open Relay public TURN so calls work out of the box.
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  const turnUrls = import.meta.env.VITE_TURN_URLS
  if (turnUrls) {
    servers.push({
      urls: turnUrls.split(',').map(s => s.trim()).filter(Boolean),
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    })
  } else {
    // Free public TURN fallback (best-effort; set your own for production).
    const u = 'openrelayproject'
    servers.push(
      { urls: 'turn:openrelay.metered.ca:80', username: u, credential: u },
      { urls: 'turn:openrelay.metered.ca:443', username: u, credential: u },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: u, credential: u },
    )
  }
  return servers
}

const ICE_SERVERS = buildIceServers()
const CONNECT_TIMEOUT_MS = 15000

// Peer-to-peer voice call over WebRTC, signalled through the room socket.
// callState: 'idle' | 'calling' | 'connecting' | 'connected'
// Direct-connect: an incoming offer auto-accepts (no manual Accept/Decline).
// 'connected' is only reported once ICE actually links the media — not when the
// SDP handshake completes — so the UI no longer claims a call that has no audio.
export function useVoiceCall(roomId) {
  const { socket } = useSocket()
  const [callState, setCallState] = useState('idle')
  const [muted, setMuted] = useState(false)             // own mic muted
  const [remoteMuted, setRemoteMuted] = useState(false) // opponent audio muted (local-only)
  const [callerName, setCallerName] = useState(null)
  const [error, setError] = useState(null)

  const pcRef          = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)   // attach to an <audio autoPlay/>
  const pendingOffer   = useRef(null)
  const pendingIce     = useRef([])
  const connectTimer   = useRef(null)

  const cleanup = useCallback(() => {
    clearTimeout(connectTimer.current)
    try { pcRef.current?.close() } catch { /* noop */ }
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    pendingOffer.current = null
    pendingIce.current = []
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current.muted = false }
    setMuted(false)
    setRemoteMuted(false)
  }, [])

  // Terminal failure — tell the peer, tear down, show why.
  const failCall = useCallback((msg) => {
    socket?.emit('call:end', { roomId })
    cleanup()
    setCallState('idle')
    setError(msg)
  }, [socket, roomId, cleanup])

  // Mark the media path as live (idempotent) and stop the connect watchdog.
  const markConnected = useCallback(() => {
    clearTimeout(connectTimer.current)
    setError(null)
    setCallState('connected')
  }, [])

  // Play remote audio; if the browser blocks autoplay (iOS Safari), retry on the
  // next user gesture instead of failing silently.
  const playRemote = useCallback(() => {
    const el = remoteAudioRef.current
    if (!el) return
    el.play?.().catch(() => {
      const resume = () => { el.play?.().catch(() => {}); document.removeEventListener('pointerdown', resume) }
      document.addEventListener('pointerdown', resume, { once: true })
    })
  }, [])

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:ice', { roomId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate })
    }
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0]
        playRemote()
      }
    }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected') markConnected()
      else if (st === 'failed') failCall('Call failed — your network blocked the connection')
    }
    // Fallback for browsers that drive iceConnectionState more reliably.
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      if (st === 'connected' || st === 'completed') markConnected()
      else if (st === 'failed') failCall('Call failed — your network blocked the connection')
    }
    pcRef.current = pc
    return pc
  }, [socket, roomId, markConnected, failCall, playRemote])

  // Start the watchdog: if media hasn't linked in time, fail cleanly.
  const armConnectWatch = useCallback(() => {
    clearTimeout(connectTimer.current)
    connectTimer.current = setTimeout(() => {
      if (pcRef.current && pcRef.current.connectionState !== 'connected') {
        failCall("Couldn't connect the call — try again")
      }
    }, CONNECT_TIMEOUT_MS)
  }, [failCall])

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
      armConnectWatch()
    } catch (e) {
      cleanup(); setCallState('idle')
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not start call')
    }
  }, [socket, roomId, getMic, createPc, cleanup, armConnectWatch])

  // Callee: accept the pending offer (auto-invoked on incoming offer).
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
      setCallState('connecting')
      armConnectWatch()
    } catch (e) {
      cleanup(); setCallState('idle'); socket.emit('call:end', { roomId })
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not join call')
    }
  }, [socket, roomId, getMic, createPc, cleanup, armConnectWatch])

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

  // Local-only: silence the opponent without touching the connection.
  const toggleRemoteMute = useCallback(() => {
    const el = remoteAudioRef.current
    if (el) { el.muted = !el.muted; setRemoteMuted(el.muted) }
  }, [])

  // Latest acceptCall, so the offer handler can auto-accept without stale deps.
  const acceptRef = useRef(acceptCall)
  useEffect(() => { acceptRef.current = acceptCall }, [acceptCall])

  useEffect(() => {
    if (!socket) return

    // Direct-connect: auto-accept the incoming offer (mic prompt is the only gate).
    const onOffer = ({ fromName, sdp }) => {
      pendingOffer.current = sdp
      setCallerName(fromName || 'Opponent')
      setCallState('connecting')
      acceptRef.current?.()
    }
    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      for (const c of pendingIce.current) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
      pendingIce.current = []
      setCallState('connecting') // wait for ICE to actually link before 'connected'
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

  return {
    callState, muted, remoteMuted, callerName, error, remoteAudioRef,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleRemoteMute,
  }
}
