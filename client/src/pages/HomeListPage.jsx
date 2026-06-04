import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import MoreDrawer from '../components/MoreDrawer.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { isGuestMode } from './AuthGatePage.jsx'
import { getTierFromGames } from '../utils/personality.js'
import styles from './HomeListPage.module.css'

const GAMES = [
  {
    mode: 'GTN',
    icon: '🎯',
    name: 'Guess The Number',
    desc: 'Higher or lower — crack your rival’s secret number first.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'BC',
    icon: '🐂',
    name: 'Bulls & Cows',
    desc: 'Break the 6-digit code. Bulls hit, cows tease.',
    accent: 'var(--color-pink)',
  },
  {
    mode: 'XOX',
    icon: '⭕',
    name: 'Tic-Tac-Toe',
    desc: 'Three in a row. Beat the AI or a friend — classic XOX.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'MATH',
    icon: '🧮',
    name: 'Math Battle',
    desc: '20 questions, first to buzz wins the point. Fast hands, faster math.',
    accent: 'var(--color-pink)',
  },
  {
    mode: 'SUDOKU',
    icon: '🔢',
    name: 'Sudoku Duel',
    desc: 'Co-op the same grid in real time. Right cells score, wrong ones cost.',
    accent: 'var(--color-juice)',
  },
]

export default function HomeListPage() {
  const navigate = useNavigate()
  const { isRegistered, user } = useAuth()
  const { playerName, totalGames } = usePlayer()
  const [showDrawer, setShowDrawer] = useState(false)

  const name = isRegistered && user?.username ? user.username : playerName
  const games = user?.totalGames ?? totalGames
  const tier = getTierFromGames(games)

  function playGame(mode) {
    // Go straight to multiplayer lobby with this mode preselected
    navigate('/lobby', { state: { mode } })
  }

  return (
    <div className={styles.screen} id="main-content">
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.iconBtn} onClick={() => navigate('/')} aria-label="Home">
          🏠
        </button>
        <button
          className={styles.iconBtn}
          onClick={() => setShowDrawer(true)}
          aria-label="More"
          aria-haspopup="dialog"
        >
          ☰
        </button>
      </div>

      {/* Greeting */}
      <div className={styles.hero}>
        <SkullMascot expression="grudging" size={88} glow />
        <div className={styles.greeting}>
          <h1 className={styles.hello}>
            Ready, <span className={styles.name}>{name}</span>?
          </h1>
          <div className={styles.metaRow}>
            <span className={styles.tier}>{tier}</span>
            {games > 0 && <span className={styles.gamesCount}>{games} games played</span>}
            {!isRegistered && <span className={styles.guestTag}>Guest</span>}
          </div>
        </div>
      </div>

      {/* Game list */}
      <div className={styles.sectionLabel}>Choose a game</div>
      <div className={styles.gameList}>
        {GAMES.map((g, i) => (
          <button
            key={g.mode}
            className={`${styles.gameCard} anim-slide-up`}
            style={{ animationDelay: `${i * 70}ms`, '--accent': g.accent }}
            onClick={() => playGame(g.mode)}
          >
            <span className={styles.gameIcon}>{g.icon}</span>
            <div className={styles.gameText}>
              <span className={styles.gameName}>{g.name}</span>
              <span className={styles.gameDesc}>{g.desc}</span>
            </div>
            <span className={styles.playArrow}>▶</span>
          </button>
        ))}
      </div>

      {/* Guest upsell */}
      {!isRegistered && (
        <button className={styles.upsell} onClick={() => navigate('/register')}>
          💀 Create an account to save your stats & climb the leaderboard →
        </button>
      )}

      <MoreDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />
    </div>
  )
}
