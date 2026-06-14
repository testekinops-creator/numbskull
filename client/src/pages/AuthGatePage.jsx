import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import GameLogo from '../components/GameLogo.jsx'
import GlitchWordmark from '../components/GlitchWordmark.jsx'
import SocialLoginButtons from '../components/auth/SocialLoginButtons.jsx'
// Guest-mode helpers now live in utils/guestMode.js (no-import module → no cycle).
// Re-exported here so existing `from './AuthGatePage.jsx'` imports keep working.
import { setGuestMode, isGuestMode, clearGuestMode } from '../utils/guestMode.js'
import styles from './AuthGatePage.module.css'

export { setGuestMode, isGuestMode, clearGuestMode }

const NAME_KEY = 'ns_name_set'

export default function AuthGatePage() {
  const navigate = useNavigate()
  const { isRegistered } = useAuth()

  // A signed-in user pressing Back onto the gate → straight to the app. (Guests
  // still see the gate, so they can sign into an existing account if they want.)
  if (isRegistered) return <Navigate to="/home" replace />

  function handleGuest() {
    setGuestMode()
    // Guest = play now. They already have an auto-generated name (changeable in
    // Settings), so skip the name-setup screen — that intermediate "Skip" step was
    // confusing ("why am I a guest after Skip?"). NAME_KEY stops a re-prompt.
    localStorage.setItem(NAME_KEY, '1')
    navigate('/home')
  }

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} anim-slide-up`}>

        <div className={styles.skullWrap}>
          <GameLogo variant="static" size={100} />
        </div>

        <div className={styles.copy}>
          <GlitchWordmark size="sm" />
          <p className={styles.subtitle}>The number game that roasts you.</p>
        </div>

        {/* Buttons — proper hierarchy */}
        <div className={styles.btnStack}>

          {/* Primary */}
          <button className={styles.btnPrimary} onClick={() => navigate('/register')}>
            Create Account
          </button>

          {/* Secondary — outline only */}
          <button className={styles.btnSecondary} onClick={() => navigate('/login')}>
            Log In
          </button>

          {/* Social + guest — a compact premium icon row (Google/Facebook appear
              once configured; Guest is always available). */}
          <SocialLoginButtons
            label="or continue with"
            onGuest={handleGuest}
            onDone={() => { localStorage.setItem(NAME_KEY, '1'); navigate('/home') }}
          />

        </div>
      </div>
    </div>
  )
}
