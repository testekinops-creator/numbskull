import { useNavigate } from 'react-router-dom'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GlitchWordmark from '../components/GlitchWordmark.jsx'
import styles from './AuthGatePage.module.css'

const GUEST_KEY = 'ns_guest_mode'
const NAME_KEY  = 'ns_name_set'

// Use sessionStorage — resets every new tab/browser session
// Guest mode is intentional per-session, not permanent
export function setGuestMode() {
  sessionStorage.setItem(GUEST_KEY, '1')
  // Clean up any stale localStorage flag from old builds
  localStorage.removeItem(GUEST_KEY)
}

export function isGuestMode() {
  return !!sessionStorage.getItem(GUEST_KEY)
}

export function clearGuestMode() {
  sessionStorage.removeItem(GUEST_KEY)
}

export default function AuthGatePage() {
  const navigate = useNavigate()

  function handleGuest() {
    setGuestMode()
    navigate('/setup')
  }

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} anim-slide-up`}>

        <div className={styles.skullWrap}>
          <SkullMascot expression="judging" size={100} glow />
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

          {/* Divider */}
          <div className={styles.divider}>
            <span className={styles.line} />
            <span className={styles.orText}>or</span>
            <span className={styles.line} />
          </div>

          {/* Tertiary — plain text link */}
          <button className={styles.guestLink} onClick={handleGuest}>
            Continue as Guest
          </button>
          <p className={styles.guestWarning}>
            ⚠️ Progress &amp; stats won't be saved
          </p>

        </div>
      </div>
    </div>
  )
}
