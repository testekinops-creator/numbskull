import { RefreshIcon, HomeIcon, GamepadIcon, CheckIcon, CloseIcon } from '../icons/Icons.jsx'
import styles from './RematchPrompt.module.css'

const IL = ({ icon: I, size = 16, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><I size={size} />{children}</span>
)

export default function RematchPrompt({
  rematchStatus,       // 'idle' | 'requesting' | 'incoming' | 'declined'
  requesterName,       // who sent the request (shown to responder)
  myName,              // my name (shown while waiting)
  onPlayAgain,         // idle → I initiate request
  onAccept,            // incoming → I say Yes
  onDecline,           // incoming → I say No / requesting → cancel
  onHome,              // declined → go home
}) {

  // ── IDLE — both players see this ─────────────────────────────────────────
  if (rematchStatus === 'idle') {
    return (
      <div className={`${styles.prompt} anim-slide-up`}>
        <button className={styles.playAgainBtn} onClick={onPlayAgain}>
          <IL icon={RefreshIcon}>Play Again</IL>
        </button>
        <button className={`btn btn-ghost ${styles.homeBtn}`} onClick={onHome}>
          <IL icon={HomeIcon}>Home</IL>
        </button>
      </div>
    )
  }

  // ── REQUESTING — I sent the request, waiting for opponent ─────────────────
  if (rematchStatus === 'requesting') {
    return (
      <div className={`${styles.prompt} ${styles.waitingPrompt} anim-slide-up`}>
        <div className={styles.waitRow}>
          <div className={styles.spinner} />
          <p className={styles.waitMsg}>Waiting for opponent to respond…</p>
        </div>
        <button className={`btn btn-ghost btn-sm ${styles.cancelBtn}`} onClick={onHome}>
          Cancel
        </button>
      </div>
    )
  }

  // ── INCOMING — opponent wants to play, I need to respond ─────────────────
  if (rematchStatus === 'incoming') {
    return (
      <div className={`${styles.prompt} ${styles.incomingPrompt} anim-bounce-land`}>
        <div className={styles.incomingHeader}>
          <span className={styles.incomingIcon}><GamepadIcon size={24} /></span>
          <p className={styles.incomingMsg}>
            <strong>{requesterName || 'Opponent'}</strong> wants to play again!
          </p>
        </div>
        <div className={styles.btnRow}>
          <button className={styles.yesBtn} onClick={onAccept}>
            <IL icon={CheckIcon}>Yes, let's go!</IL>
          </button>
          <button className={styles.noBtn} onClick={onDecline}>
            <IL icon={CloseIcon}>No thanks</IL>
          </button>
        </div>
      </div>
    )
  }

  // ── DECLINED — my request was turned down ─────────────────────────────────
  if (rematchStatus === 'declined') {
    return (
      <div className={`${styles.prompt} anim-slide-up`}>
        <p className={styles.declinedMsg}>They said no.</p>
        <button className={`btn btn-ghost ${styles.homeBtn}`} onClick={onHome}>
          ← Back to Home
        </button>
      </div>
    )
  }

  return null
}
