import { createPortal } from 'react-dom'
import { useVoiceCall } from '../../hooks/useVoiceCall.js'
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon } from '../icons/Icons.jsx'
import styles from './VoiceCall.module.css'

// Voice-call control for a multiplayer room. The center cluster only ever holds
// the small "start call" button (so it can't push the players' name/READY off
// the card). Once a call is active, the controls live in a floating call bar
// portaled to <body> — status + mic mute + opponent-audio mute + hang up.
export default function VoiceCall({ roomId, opponentName }) {
  const {
    callState, muted, remoteMuted, error,
    remoteAudioRef, startCall, endCall, toggleMute, toggleRemoteMute,
  } = useVoiceCall(roomId)

  const active = callState === 'calling' || callState === 'connecting' || callState === 'connected'

  const statusText =
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

      {/* Floating call bar — portaled so it never affects the header layout. */}
      {active && createPortal(
        <div className={`${styles.callBar} anim-slide-up`} role="dialog" aria-label="Voice call">
          <span className={`${styles.status} ${styles[callState]}`}>
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

      {error && callState === 'idle' && <span className={styles.err} role="status">{error}</span>}
    </>
  )
}
