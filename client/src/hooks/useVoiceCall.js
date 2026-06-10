import { useState, useRef, useEffect, useCallback } from 'react'
import { useSocket } from '../contexts/SocketContext.jsx'

// ICE servers: STUN locates peers; TURN relays media when a direct path can't
// form (mobile data / symmetric NAT) — without TURN, calls "connect" but stay
// silent for many users.
//
// MULTIPLE TURN PROVIDERS = automatic failover. List up to 3 providers (each
// with its own credentials). The browser gathers relay candidates from all of
// them; if one provider's free quota is exhausted (or it's down) it rejects the
// allocation and ICE simply uses a relay from the next — no manual switching.
// Configure via Vercel env (provider 1 = no suffix, then _2, _3):
//   VITE_TURN_URLS / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
//   VITE_TURN_URLS_2 / VITE_TURN_USERNAME_2 / VITE_TURN_CREDENTIAL_2
//   VITE_TURN_URLS_3 / VITE_TURN_USERNAME_3 / VITE_TURN_CREDENTIAL_3
// (URLs are comma-separated.) Falls back to free public TURN if none are set.
//
// NB: import.meta.env keys must be referenced statically so Vite inlines them.
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  const providers = [
    { urls: import.meta.env.VITE_TURN_URLS,   username: import.meta.env.VITE_TURN_USERNAME,   credential: import.meta.env.VITE_TURN_CREDENTIAL },
    { urls: import.meta.env.VITE_TURN_URLS_2, username: import.meta.env.VITE_TURN_USERNAME_2, credential: import.meta.env.VITE_TURN_CREDENTIAL_2 },
    { urls: import.meta.env.VITE_TURN_URLS_3, username: import.meta.env.VITE_TURN_USERNAME_3, credential: import.meta.env.VITE_TURN_CREDENTIAL_3 },
  ]
  let configured = 0
  for (const p of providers) {
    if (!p.urls) continue
    servers.push({
      urls: p.urls.split(',').map(s => s.trim()).filter(Boolean),
      username: p.username || '',
      credential: p.credential || '',
    })
    configured++
  }
  if (!configured) {
    // Free public TURN fallback (best-effort; set your own for reliability).
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
const MAX_ICE_RESTARTS = 4        // auto-reconnect attempts before we give up
const DISCONNECT_GRACE_MS = 4000  // let a transient 'disconnected' self-heal first

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
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false) // iOS autoplay blocked → tap to hear
  const [reconnecting, setReconnecting] = useState(false)         // mid-call recovery in progress

  const pcRef          = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)   // attach to an <audio autoPlay/>
  const pendingOffer   = useRef(null)
  const pendingIce     = useRef([])
  const connectTimer   = useRef(null)
  const isCallerRef     = useRef(false) // true = we made the offer (we drive ICE restarts)
  const wasConnectedRef = useRef(false) // only auto-reconnect a call that actually linked
  const restartsRef     = useRef(0)
  const disconnectTimer = useRef(null)

  const cleanup = useCallback(() => {
    clearTimeout(connectTimer.current)
    clearTimeout(disconnectTimer.current)
    try { pcRef.current?.close() } catch { /* noop */ }
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    pendingOffer.current = null
    pendingIce.current = []
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current.muted = false }
    setMuted(false)
    setRemoteMuted(false)
    setNeedsAudioUnlock(false)
    setReconnecting(false)
    wasConnectedRef.current = false
    restartsRef.current = 0
    isCallerRef.current = false
  }, [])

  // Terminal failure — tell the peer, tear down, show why.
  const failCall = useCallback((msg) => {
    socket?.emit('call:end', { roomId })
    cleanup()
    setCallState('idle')
    setError(msg)
  }, [socket, roomId, cleanup])

  // Mark the media path as live (idempotent) and stop the watchdog/recovery.
  const markConnected = useCallback(() => {
    clearTimeout(connectTimer.current)
    clearTimeout(disconnectTimer.current)
    wasConnectedRef.current = true
    restartsRef.current = 0
    setReconnecting(false)
    setError(null)
    setCallState('connected')
  }, [])

  // ── Auto-reconnect: ICE restart when a LIVE call drops ──────────────────────
  // The caller re-offers with iceRestart; the callee (which can't offer without a
  // glare collision) just asks the caller to do it via call:restart.
  const iceRestartAsCaller = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !socket) return
    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { roomId, sdp: offer, renegotiate: true })
    } catch { /* a later state change will retry */ }
  }, [socket, roomId])
  const iceRestartRef = useRef(iceRestartAsCaller)
  useEffect(() => { iceRestartRef.current = iceRestartAsCaller }, [iceRestartAsCaller])

  const recover = useCallback(() => {
    if (!wasConnectedRef.current) return            // only reconnect calls that linked
    clearTimeout(disconnectTimer.current)
    if (restartsRef.current >= MAX_ICE_RESTARTS) {
      socket?.emit('call:end', { roomId })
      cleanup(); setCallState('idle')
      setError('Lost the call — network connection dropped')
      return
    }
    restartsRef.current += 1
    setReconnecting(true)
    if (isCallerRef.current) iceRestartAsCaller()
    else socket?.emit('call:restart', { roomId })   // ask the caller to restart
  }, [socket, roomId, cleanup, iceRestartAsCaller])

  // Play remote audio. iOS Safari blocks autoplay outside a user gesture — and a
  // callee that auto-accepts an offer has no gesture — so on failure we (1) flag
  // the UI to show a visible "tap to hear" prompt and (2) retry on the next tap
  // anywhere, rather than staying silent with the call looking connected.
  const playRemote = useCallback(() => {
    const el = remoteAudioRef.current
    if (!el) return
    el.muted = false
    el.play?.()
      .then(() => setNeedsAudioUnlock(false))
      .catch(() => {
        setNeedsAudioUnlock(true)
        const resume = () => {
          el.play?.().then(() => setNeedsAudioUnlock(false)).catch(() => {})
          document.removeEventListener('pointerdown', resume)
        }
        document.addEventListener('pointerdown', resume, { once: true })
      })
  }, [])

  // Explicit unlock from a button tap (counts as a user gesture on iOS).
  const unlockAudio = useCallback(() => { playRemote() }, [playRemote])

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
    // A drop AFTER the call has linked → try to auto-reconnect (ICE restart);
    // a failure DURING the initial connect → fail cleanly as before.
    const onDrop = () => {
      if (wasConnectedRef.current) recover()
      else failCall('Call failed — your network blocked the connection')
    }
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected') markConnected()
      else if (st === 'failed') onDrop()
    }
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      if (st === 'connected' || st === 'completed') markConnected()
      else if (st === 'failed') onDrop()
      else if (st === 'disconnected' && wasConnectedRef.current) {
        // Usually a transient blip — give it a moment to self-heal, then restart.
        setReconnecting(true)
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = setTimeout(() => {
          const cur = pcRef.current?.iceConnectionState
          if (cur === 'disconnected' || cur === 'failed') recover()
        }, DISCONNECT_GRACE_MS)
      }
    }
    pcRef.current = pc
    return pc
  }, [socket, roomId, markConnected, failCall, recover, playRemote])

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
    // Explicit constraints give consistent, clean audio across iOS/Android (and
    // avoid some Android devices defaulting to a noisy/raw capture).
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
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
      isCallerRef.current = true               // we offer → we drive ICE restarts
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
      isCallerRef.current = false              // we answer → caller drives ICE restarts
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

  const clearError = useCallback(() => setError(null), [])

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
    // A `renegotiate` offer is an ICE restart for the LIVE call → answer it on the
    // existing connection instead of starting a brand-new call.
    const onOffer = async ({ fromName, sdp, renegotiate }) => {
      const pc = pcRef.current
      if (renegotiate && pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.emit('call:answer', { roomId, sdp: answer })
        } catch { /* noop — a later state change will retry */ }
        return
      }
      pendingOffer.current = sdp
      setCallerName(fromName || 'Opponent')
      setCallState('connecting')
      acceptRef.current?.()
    }
    // Callee asked us (the caller) to ICE-restart the live call.
    const onRestart = () => { if (isCallerRef.current) iceRestartRef.current?.() }
    const onAnswer = async ({ sdp }) => {
      const pc = pcRef.current
      if (!pc || pc.signalingState !== 'have-local-offer') return  // stray/late answer
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      for (const c of pendingIce.current) { try { await pc.addIceCandidate(c) } catch { /* noop */ } }
      pendingIce.current = []
      if (!wasConnectedRef.current) setCallState('connecting')      // initial connect only
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
    socket.on('call:restart', onRestart)
    return () => {
      socket.off('call:offer', onOffer)
      socket.off('call:answer', onAnswer)
      socket.off('call:ice', onIce)
      socket.off('call:end', onEnd)
      socket.off('call:declined', onDeclined)
      socket.off('call:restart', onRestart)
    }
  }, [socket, roomId, cleanup])

  useEffect(() => () => cleanup(), [cleanup])  // end call when leaving the room

  // iOS/Android suspend media when the tab is backgrounded; nudge playback to
  // resume (and re-prompt if needed) when the user returns to a live call.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && callState === 'connected') playRemote() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [callState, playRemote])

  return {
    callState, reconnecting, muted, remoteMuted, callerName, error, clearError, remoteAudioRef,
    needsAudioUnlock, unlockAudio,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleRemoteMute,
  }
}
