import { useVoiceCall } from '../../hooks/useVoiceCall.js'
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon } from '../icons/Icons.jsx'
import styles from './VoiceCall.module.css'

// Drop-in voice-call control for a multiplayer room. One tap connects straight
// to the opponent (direct-connect — the callee auto-accepts), then in-call
// controls expose mic mute + opponent-audio mute + hang up. Renders the hidden
// remote-audio element inline.
export default function VoiceCall({ roomId, opponentName }) {
  const {
    callState, muted, remoteMuted, error,
    remoteAudioRef, startCall, endCall, toggleMute, toggleRemoteMute,
  } = useVoiceCall(roomId)

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {callState === 'idle' && (
        <button className={styles.callBtn} onClick={startCall} title={`Voice call ${opponentName || ''}`.trim()} aria-label="Start voice call">
          <PhoneIcon size={20} />
        </button>
      )}

      {(callState === 'calling' || callState === 'connecting') && (
        <button className={`${styles.callBtn} ${styles.calling}`} onClick={endCall}
          title={callState === 'calling' ? 'Calling… tap to cancel' : 'Connecting…'} aria-label="Cancel call">
          <span className={styles.pulse} />
          <PhoneIcon size={20} />
        </button>
      )}

      {callState === 'connected' && (
        <div className={styles.inCall}>
          <button className={`${styles.callBtn} ${muted ? styles.muted : styles.live}`} onClick={toggleMute}
            title={muted ? 'Unmute your mic' : 'Mute your mic'} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
            {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
          </button>
          <button className={`${styles.callBtn} ${remoteMuted ? styles.muted : styles.live}`} onClick={toggleRemoteMute}
            title={remoteMuted ? `Unmute ${opponentName || 'opponent'}` : `Mute ${opponentName || 'opponent'}`}
            aria-label={remoteMuted ? 'Unmute opponent' : 'Mute opponent'}>
            {remoteMuted ? <SpeakerOffIcon size={20} /> : <SpeakerIcon size={20} />}
          </button>
          <button className={`${styles.callBtn} ${styles.end}`} onClick={endCall} title="End call" aria-label="End call">
            <PhoneOffIcon size={20} />
          </button>
        </div>
      )}

      {error && callState === 'idle' && <span className={styles.err} role="status">{error}</span>}
    </>
  )
}
