import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useVoiceCall } from '../../hooks/useVoiceCall.js'
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon } from '../icons/Icons.jsx'
import styles from './VoiceCall.module.css'

// Voice-call control for a multiplayer room. The center cluster only ever holds
// the small "start call" button (so it can't push the players' name/READY off
// the card). Once a call is active, the controls live in a floating call bar
// portaled to <body> — status + mic mute + opponent-audio mute + hang up.
export default function VoiceCall({ roomId, opponentName, onActiveChange }) {
  const {
    callState, reconnecting, muted, remoteMuted, error, clearError, needsAudioUnlock, unlockAudio,
    remoteAudioRef, startCall, endCall, toggleMute, toggleRemoteMute,
  } = useVoiceCall(roomId)

  // During a call the controls collapse to a small "In call" pill (so they don't
  // clutter the screen) and expand to the full bar on scroll or a tap, then tuck
  // back after a few idle seconds. The pill stays visible the whole call, so you
  // never lose the status / mute indicator / one-tap hang-up.
  const [expanded, setExpanded] = useState(false)
  const collapseTimer = useRef(null)
  const armCollapse = useCallback(() => {
    clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => setExpanded(false), 4000)
  }, [])

  // Auto-dismiss errors (shown as a floating toast, never inline in the cluster).
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => clearError(), 4500)
    return () => clearTimeout(t)
  }, [error, clearError])

  const active = callState === 'calling' || callState === 'connecting' || callState === 'connected'

  // Tell the parent (the action dock) when a call is live so it can lift itself
  // above the floating call bar and stay put — otherwise the call bar covers it.
  useEffect(() => { onActiveChange?.(active) }, [active, onActiveChange])

  // Expand the controls on scroll while a call is live, then re-collapse on idle.
  useEffect(() => {
    if (!active) { setExpanded(false); clearTimeout(collapseTimer.current); return }
    const onScroll = () => { setExpanded(true); armCollapse() }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(collapseTimer.current) }
  }, [active, armCollapse])

  const collapsedLabel =
    reconnecting               ? 'Reconnecting…' :
    callState === 'calling'    ? 'Calling…' :
    callState === 'connecting' ? 'Connecting…' :
    muted                      ? 'Muted' : 'In call'

  const statusText =
    reconnecting               ? 'Reconnecting…' :
    callState === 'calling'    ? `Calling ${opponentName || 'opponent'}…` :
    callState === 'connecting' ? 'Connecting…' :
    callState === 'connected'  ? `In call · ${opponentName || 'opponent'}` : ''

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Cluster button: only the start affordance lives here. */}
      {callState === 'idle' && (
        <button className={styles.callBtn} onClick={startCall} title={`Voice call ${opponentName || ''}`.trim()} aria-label="Start voice call">
          <PhoneIcon size={20} />
        </button>
      )}

      {/* Collapsed "In call" pill — always visible during a call; tap to expand. */}
      {active && !expanded && createPortal(
        <button
          className={`${styles.callPill} ${muted ? styles.pillMuted : ''}`}
          onClick={() => { setExpanded(true); armCollapse() }}
          aria-label="Show call controls"
          title={statusText}
        >
          <span className={`${styles.status} ${styles[reconnecting ? 'connecting' : callState]}`}>
            <span className={styles.dot} />
          </span>
          <span className={styles.pillLabel}>{collapsedLabel}</span>
        </button>,
        document.body,
      )}

      {/* Floating call bar — portaled so it never affects the header layout. */}
      {active && expanded && createPortal(
        <div className={`${styles.callBar} anim-slide-up`} role="dialog" aria-label="Voice call"
          onPointerDown={armCollapse}>
          <span className={`${styles.status} ${styles[reconnecting ? 'connecting' : callState]}`}>
            <span className={styles.dot} />
            {statusText}
          </span>
          <div className={styles.barControls}>
            {callState === 'connected' && (
              <>
                <button className={`${styles.callBtn} ${muted ? styles.muted : styles.live}`} onClick={toggleMute}
                  title={muted ? 'Unmute your mic' : 'Mute your mic'} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
                  {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
                </button>
                <button className={`${styles.callBtn} ${remoteMuted ? styles.muted : styles.live}`} onClick={toggleRemoteMute}
                  title={remoteMuted ? `Unmute ${opponentName || 'opponent'}` : `Mute ${opponentName || 'opponent'}`}
                  aria-label={remoteMuted ? 'Unmute opponent' : 'Mute opponent'}>
                  {remoteMuted ? <SpeakerOffIcon size={20} /> : <SpeakerIcon size={20} />}
                </button>
              </>
            )}
            <button className={`${styles.callBtn} ${styles.end}`} onClick={endCall}
              title={callState === 'connected' ? 'End call' : 'Cancel'} aria-label="End call">
              <PhoneOffIcon size={20} />
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* iOS blocked autoplay → a visible, tappable prompt so the call isn't
          silently muted. Tapping counts as the gesture iOS needs to play audio. */}
      {needsAudioUnlock && callState === 'connected' && createPortal(
        <button className={`${styles.audioUnlock} anim-slide-up`} onClick={unlockAudio}>
          🔊 Tap to hear {opponentName || 'opponent'}
        </button>,
        document.body,
      )}

      {/* Errors float as a portaled toast — never inline in the cluster, so they
          can't widen the row and push the players' name/READY off the card. */}
      {error && createPortal(
        <div className={`${styles.errToast} anim-slide-up`} role="status">{error}</div>,
        document.body,
      )}
    </>
  )
}
