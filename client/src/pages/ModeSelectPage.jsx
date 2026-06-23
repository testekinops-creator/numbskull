import { useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext.jsx'
import GameIcon from '../components/icons/GameIcon.jsx'
import { LockIcon } from '../components/icons/Icons.jsx'
import styles from './ModeSelectPage.module.css'

export default function ModeSelectPage() {
  const navigate = useNavigate()
  const { bcUnlocked } = useGame()

  return (
    <div className={styles.screen}>
      <div className={`panel ${styles.page}`}>

        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} aria-label="Back">
            ← Back
          </button>
          <h1 className={styles.title}>Choose Mode</h1>
        </div>

        {/* Core modes */}
        <div className={styles.modes}>
          {/* GTN — always unlocked */}
          <button
            className={`${styles.modeCard} ${styles.unlocked} anim-slide-up`}
            onClick={() => navigate('/play/GTN')}
          >
            <div className={styles.modeTop}>
              <span className={styles.modeIcon}><GameIcon icon="gtn" size={34} /></span>
              <div className={styles.modeText}>
                <h2 className={styles.modeName}>Guess The Number</h2>
                <p className={styles.modeDesc}>Higher or lower. 1–100. How fast can you find it?</p>
              </div>
            </div>
            <div className={styles.modeFooter}>
              <span className={`badge badge-juice`}>PLAY NOW</span>
              <span className={styles.modeMeta}>Optimal: 7 guesses</span>
            </div>
          </button>

          {/* B&C — locked until 3 GTN wins */}
          <button
            className={`${styles.modeCard} ${bcUnlocked ? styles.unlocked : styles.locked} anim-slide-up`}
            style={{ animationDelay: '60ms' }}
            onClick={() => bcUnlocked && navigate('/play/BC')}
            disabled={!bcUnlocked}
            aria-describedby="bc-lock-hint"
          >
            <div className={styles.modeTop}>
              <span className={styles.modeIcon}>{bcUnlocked ? <GameIcon icon="bc" size={34} /> : <LockIcon size={28} />}</span>
              <div className={styles.modeText}>
                <h2 className={styles.modeName}>Bulls &amp; Cows</h2>
                <p className={styles.modeDesc}>Crack the 4-digit code. Bulls hit, cows misplace.</p>
              </div>
            </div>
            <div className={styles.modeFooter}>
              {bcUnlocked ? (
                <span className={`badge badge-juice`}>PLAY NOW</span>
              ) : (
                <span className={`badge badge-pink`} id="bc-lock-hint">
                  Win 3 GTN to unlock
                </span>
              )}
              <span className={styles.modeMeta}>10 guesses max</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  )
}
