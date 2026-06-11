import { useState, useEffect, useRef } from 'react'
import EmojiPicker from './EmojiPicker.jsx'
import VoiceCall from '../match/VoiceCall.jsx'
import RulesModal from '../match/RulesModal.jsx'
import { useMusicEnabled } from '../../services/gameMusic.js'
import styles from './RoomActionDock.module.css'

// Premium one-stop action dock for a room: emoji · chat · call · help · music,
// in a single frosted-glass bar pinned bottom-centre. Scroll-aware — it slides
// out of the way while you scroll down and returns on scroll-up or when scrolling
// stops, so it never covers the board mid-action. Adapts per room:
//   • emoji + chat   → only when an opponent is present
//   • call           → 1v1 rooms only (voice can't group-call)
//   • help + music   → always
export default function RoomActionDock({ roomId, mode, hasOpponent, showCall, opponentName, unread = 0, callActive = false, onCallActiveChange, tuckedAway = false, onEmoji, onOpenChat }) {
  const [musicOn, setMusicOn] = useMusicEnabled()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const idle = useRef(null)
  const callActiveRef = useRef(false)
  useEffect(() => { callActiveRef.current = callActive }, [callActive])

  // Scroll-aware reveal. Reduced-motion users keep it permanently visible, and
  // during a live call the dock stays pinned (above the call bar) so its controls
  // never disappear behind it while scrolling.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY.current
      lastY.current = y
      if (callActiveRef.current) { setHidden(false); return }   // call live → always shown
      if (y < 40) setHidden(false)            // near the top → always shown
      else if (dy > 6) setHidden(true)         // scrolling down → get out of the way
      else if (dy < -6) setHidden(false)       // scrolling up → come back
      clearTimeout(idle.current)
      idle.current = setTimeout(() => setHidden(false), 1200)   // settled → reveal
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(idle.current) }
  }, [])

  // At game over the dock tucks away (so it can't cover the Play Again / Home
  // buttons) but stays mounted — that keeps an in-progress call alive.
  const isHidden = tuckedAway || (hidden && !callActive)

  return (
    <>
      <div
        className={`${styles.dock} ${isHidden ? styles.hidden : ''} ${callActive && !tuckedAway ? styles.raised : ''}`}
        role="toolbar"
        aria-label="Room actions"
        aria-hidden={tuckedAway || undefined}
      >
        {hasOpponent && (
          <div className={styles.slot}>
            <EmojiPicker onPick={onEmoji} />
          </div>
        )}

        {hasOpponent && (
          <button className={styles.btn} onClick={onOpenChat} aria-label="Open chat" title="Chat">
            <ChatIcon />
            {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
          </button>
        )}

        {showCall && (
          <div className={styles.slot}>
            <VoiceCall roomId={roomId} opponentName={opponentName} onActiveChange={onCallActiveChange} />
          </div>
        )}

        <button className={styles.btn} onClick={() => setRulesOpen(true)} aria-label="How to play" title="How to play">
          <HelpIcon />
        </button>

        <button
          className={`${styles.btn} ${musicOn ? styles.active : ''}`}
          onClick={() => setMusicOn(!musicOn)}
          aria-pressed={musicOn}
          aria-label={musicOn ? 'Turn music off' : 'Turn music on'}
          title={musicOn ? 'Music on' : 'Music off'}
        >
          <MusicIcon off={!musicOn} />
        </button>
      </div>

      {rulesOpen && <RulesModal mode={mode} onClose={() => setRulesOpen(false)} />}
    </>
  )
}

/* ── Crafted icons (premium, stroke-based) ─────────────────────────────────── */
function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-4-.9L3 20l1.4-5a8.38 8.38 0 0 1-.9-4A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5Z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function HelpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.3" stroke="currentColor" strokeWidth="2" />
      <path d="M9.3 9.3a2.8 2.8 0 0 1 5.4.7c0 1.8-2.7 2.3-2.7 4.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.3" r="1.1" fill="currentColor" />
    </svg>
  )
}
function MusicIcon({ off }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      {off && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}
