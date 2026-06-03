import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import { useGame } from '../contexts/GameContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import AnnouncementBanner from '../components/AnnouncementBanner.jsx'
import SeasonalBanner from '../components/SeasonalBanner.jsx'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const { bcUnlocked, state } = useGame()
  const { isRegistered, user } = useAuth()
  const [hovering, setHovering] = useState(null)

  function handlePlay(mode) {
    if (mode === 'BC' && !bcUnlocked) return
    navigate(`/play/${mode}`)
  }

  const expression = hovering === 'BC' && !bcUnlocked ? 'judging' : 'neutral'

  return (
    <div className={styles.home} id="main-content">
      <AnnouncementBanner />
      <SeasonalBanner />
      <div className={styles.hero}>
        <div className={`${styles.logoWrap} anim-logo-enter`}>
          <SkullMascot expression={expression} size={120} />
        </div>

        <h1 className={styles.wordmark}>
          Numb<span className={styles.accent}>skull</span>
        </h1>
        <p className={styles.tagline}>The number game that roasts you.</p>
      </div>

      <div className={`${styles.modes} stagger`}>
        <button
          className={`${styles.modeCard} anim-slide-up`}
          onClick={() => handlePlay('GTN')}
          onMouseEnter={() => setHovering('GTN')}
          onMouseLeave={() => setHovering(null)}
        >
          <span className={styles.modeIcon}>🎯</span>
          <div className={styles.modeInfo}>
            <h2>Guess The Number</h2>
            <p>Higher / lower. How many guesses?</p>
          </div>
          <span className={`badge badge-juice ${styles.modeBadge}`}>Play</span>
        </button>

        <button
          className={`${styles.modeCard} anim-slide-up ${!bcUnlocked ? styles.locked : ''}`}
          onClick={() => handlePlay('BC')}
          onMouseEnter={() => setHovering('BC')}
          onMouseLeave={() => setHovering(null)}
          disabled={!bcUnlocked}
          aria-describedby={!bcUnlocked ? 'bc-lock-hint' : undefined}
        >
          <span className={styles.modeIcon}>🐂</span>
          <div className={styles.modeInfo}>
            <h2>Bulls &amp; Cows</h2>
            <p>Crack the 4-digit code.</p>
          </div>
          {bcUnlocked ? (
            <span className={`badge badge-juice ${styles.modeBadge}`}>Play</span>
          ) : (
            <span className={`badge badge-pink ${styles.modeBadge}`} id="bc-lock-hint">
              Win 3 GTN
            </span>
          )}
        </button>
      </div>

      <div className={styles.multiRow}>
        <button className={`btn btn-ghost ${styles.multiBtn}`} onClick={() => navigate('/lobby')}>
          ⚡ Multiplayer
        </button>
        <button className={`btn btn-ghost ${styles.multiBtn}`} onClick={() => navigate('/spectate')}>
          👁 Watch Live
        </button>
      </div>

      <div className={styles.engageRow}>
        <button className={`btn btn-ghost ${styles.engageBtn}`} onClick={() => navigate('/daily')}>
          ☀️ Daily
        </button>
        <button className={`btn btn-ghost ${styles.engageBtn}`} onClick={() => navigate('/leaderboard')}>
          🏆 Leaderboard
        </button>
        <button className={`btn btn-ghost ${styles.engageBtn}`} onClick={() => navigate('/badges')}>
          🏅 Badges
        </button>
        <button className={`btn btn-ghost ${styles.engageBtn}`} onClick={() => navigate('/theater')}>
          🎬 Theater
        </button>
      </div>

      <div className={styles.modesRow}>
        <p className={styles.modesLabel}>More Modes</p>
        <div className={styles.modesBtns}>
          <button className={`btn btn-ghost ${styles.modeExtraBtn}`} onClick={() => navigate('/countdown')}>
            🔢 Countdown
          </button>
          <button className={`btn btn-ghost ${styles.modeExtraBtn}`} onClick={() => navigate('/chain')}>
            🧮 Number Chain
          </button>
          <button className={`btn btn-ghost ${styles.modeExtraBtn}`} onClick={() => navigate('/towers')}>
            🏗️ Towers
          </button>
        </div>
      </div>

      <div className={styles.profileRow}>
        <button className={`btn btn-ghost ${styles.profileBtn}`} onClick={() => navigate('/profile')}>
          {isRegistered ? `👤 ${user.username}` : '👤 Profile'}
        </button>
        {!isRegistered && (
          <button className={`btn btn-primary ${styles.profileBtn}`} onClick={() => navigate('/register')}>
            Sign Up Free
          </button>
        )}
        <button className={`btn btn-ghost ${styles.settingsBtn}`} onClick={() => navigate('/settings')} aria-label="Settings">
          ⚙️
        </button>
      </div>

      {state.totalGames > 0 && (
        <p className={styles.stats}>
          {state.totalGames} games played · {state.gtnWins} GTN wins
        </p>
      )}
    </div>
  )
}
