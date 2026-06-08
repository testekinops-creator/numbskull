import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import GameLogo from '../components/GameLogo.jsx'
import MatrixRain from '../components/MatrixRain.jsx'
import GlitchWordmark from '../components/GlitchWordmark.jsx'
import PlayButton from '../components/PlayButton.jsx'
import SplashOverlay, { shouldShowSplash } from '../components/SplashOverlay.jsx'
import MoreDrawer from '../components/MoreDrawer.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isGuestMode } from './AuthGatePage.jsx'
import { getTierFromGames } from '../utils/personality.js'
import styles from './TitleScreen.module.css'

const NAME_KEY = 'ns_name_set'

export default function TitleScreen() {
  const navigate = useNavigate()
  const { totalGames } = usePlayer()
  const { isRegistered } = useAuth()

  const [showSplash,  setShowSplash]  = useState(() => shouldShowSplash())
  const [showDrawer,  setShowDrawer]  = useState(false)
  const [playPressed, setPlayPressed] = useState(false)

  const onSplashDone = useCallback(() => setShowSplash(false), [])

  function handlePlay() {
    setPlayPressed(true)

    // Registered or guest → go to the games home list
    if (isRegistered || isGuestMode()) {
      const hasSetName = localStorage.getItem(NAME_KEY)
      setTimeout(() => navigate(hasSetName ? '/home' : '/setup'), 120)
      return
    }

    // Not authenticated → auth gate
    setTimeout(() => navigate('/auth'), 120)
  }

  const tier = getTierFromGames(totalGames)

  return (
    <div className={styles.screen} id="main-content">
      {showSplash && <SplashOverlay onDone={onSplashDone} />}

      {/* Top bar */}
      {/* Only show the ☰ menu after the user has authenticated */}
      {(isRegistered || isGuestMode()) && (
        <div className={styles.topBar}>
          <div />
          <button
            className={`${styles.iconBtn} ${styles.menuBtn}`}
            onClick={() => setShowDrawer(true)}
            aria-label="More"
            aria-haspopup="dialog"
          >
            ☰
          </button>
        </div>
      )}

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.skullWrap}>
          <MatrixRain columns={26} />
          <div className={styles.logoFront}>
            <GameLogo size={184} />
          </div>
        </div>
        <div className={styles.branding}>
          <GlitchWordmark size="lg" />
          <p className={styles.tagline}>The number game that roasts you.</p>
        </div>
      </div>

      {/* PRIMARY CTA */}
      <div className={styles.actions}>
        <PlayButton onClick={handlePlay} pressed={playPressed} />
      </div>

      {/* Stats strip */}
      {totalGames > 0 && (
        <div className={styles.statsStrip}>
          <span className={styles.statValue}>{totalGames}</span>
          <span className={styles.statLabel}>games</span>
          <span className={styles.statDot}>·</span>
          <span className={styles.tier}>{tier}</span>
        </div>
      )}

      <MoreDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />
    </div>
  )
}
