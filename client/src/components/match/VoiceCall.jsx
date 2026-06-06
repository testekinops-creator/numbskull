import { createPortal } from 'react-dom'
import { useVoiceCall } from '../../hooks/useVoiceCall.js'
import styles from './VoiceCall.module.css'

// Drop-in voice-call control for a multiplayer room. Renders the call button
// (+ in-call controls) inline, plus an incoming-call overlay and the hidden
// remote-audio element.
export default function VoiceCall({ roomId, opponentName }) {
  const {
    callState, muted, callerName, error,
    remoteAudioRef, startCall, acceptCall, declineCall, endCall, toggleMute,
  } = useVoiceCall(roomId)

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Inline control in the chat bar */}
      {callState === 'idle' && (
        <button className={styles.callBtn} onClick={startCall} title={`Voice call ${opponentName || ''}`.trim()} aria-label="Start voice call">
          📞
        </button>
      )}
      {callState === 'calling' && (
        <button className={`${styles.callBtn} ${styles.calling}`} onClick={endCall} title="Cancel call" aria-label="Cancel call">
          <span className={styles.pulse} />📞
        </button>
      )}
      {callState === 'connected' && (
        <div className={styles.inCall}>
          <button className={`${styles.callBtn} ${muted ? styles.muted : styles.live}`} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🎙️'}
          </button>
          <button className={`${styles.callBtn} ${styles.end}`} onClick={endCall} aria-label="End call">
            📵
          </button>
        </div>
      )}

      {/* Incoming call overlay — portaled to <body> so no transformed ancestor
          can contain its position:fixed and clip the Accept/Decline buttons. */}
      {callState === 'incoming' && createPortal(
        <div className={styles.overlay} role="dialog" aria-label="Incoming call">
          <div className={`${styles.card} anim-bounce-land`}>
            <div className={styles.ring}>📞</div>
            <h2 className={styles.callTitle}>{callerName || 'Opponent'} is calling…</h2>
            <p className={styles.callSub}>Voice call</p>
            <div className={styles.actions}>
              <button className={`${styles.action} ${styles.accept}`} onClick={acceptCall}>Accept</button>
              <button className={`${styles.action} ${styles.decline}`} onClick={declineCall}>Decline</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {error && callState === 'idle' && <span className={styles.err} role="status">{error}</span>}
    </>
  )
}
