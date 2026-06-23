import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GameLogo from '../components/GameLogo.jsx'
import MoreDrawer from '../components/MoreDrawer.jsx'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import { HomeIcon, MenuIcon, EyeIcon, SkullIcon, CoinIcon, UsersIcon, BotIcon, ClockIcon } from '../components/icons/Icons.jsx'
import GameIcon from '../components/icons/GameIcon.jsx'
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
    name: 'Sudoku',
    desc: 'Solo with 3 lives, notes & hints — or duel a rival to claim the grid.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'QUEENS',
    icon: '👑',
    name: 'Queens',
    desc: 'One queen per row, column & color — none touching. Solo for time, or race a friend to solve first.',
    accent: 'var(--color-warning)',
  },
  {
    mode: 'TANGO',
    icon: '☀️',
    name: 'Tango',
    desc: 'Fill ☀️/🌙 — 3 each per row & column, no 3 in a row, obey =/×. Solo for time, or race 2–8 players.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'ZIP',
    icon: '🔢',
    name: 'Zip',
    desc: 'Draw one path 1→last through every cell, dodging walls. Solo for time, or race 2–8 players.',
    accent: 'var(--color-pink)',
  },
  {
    mode: 'PINPOINT',
    icon: '📌',
    name: 'Pinpoint',
    desc: 'Guess the hidden category from its clues — the fewer you need, the more you score. Best of 5, head-to-head.',
    accent: 'var(--color-warning)',
  },
  {
    mode: 'CROSSCLIMB',
    icon: '🪜',
    name: 'Crossclimb',
    desc: 'Reorder the word ladder so each step changes one letter. Race 2–8 players — fastest correct ladder wins.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'LUDO',
    icon: '🎲',
    name: 'Ludo',
    desc: 'Roll, race your 4 tokens home, capture rivals on the way.',
    accent: 'var(--color-juice)',
    chips: [{ icon: 'users', label: '2–4' }, { icon: 'bot', label: 'vs Bots' }, { icon: 'clock', label: '~10 min' }],
  },
  {
    mode: 'SPIN',
    icon: '🎡',
    name: 'Spin Battle',
    desc: 'Spin the wheel, call letters, solve the phrase. Word-puzzle roulette.',
    accent: 'var(--color-pink)',
  },
  {
    mode: 'SOS',
    icon: '🔠',
    name: 'SOS',
    desc: 'Place S or O, spell S‑O‑S in any direction, draw the line to score.',
    accent: 'var(--color-juice)',
  },
  {
    mode: 'RMCS',
    icon: '👑',
    name: 'Raja Mantri',
    desc: 'The classic Raja Mantri Chor Sipahi — read faces, bluff hard, catch the Chor. 4 players.',
    accent: 'var(--color-warning)',
    hidden: true,   // temporarily disabled — flip to re-enable
  },
  {
    mode: 'RUMMY',
    icon: '🃏',
    name: 'Rummy',
    desc: '13-card Indian Rummy — draw, discard, form sequences & sets, declare to win. 2–6 players.',
    accent: 'var(--color-pink)',
    hidden: true,   // temporarily disabled — flip to re-enable
  },
]

// Maps each game mode to its premium GameIcon glyph (RMCS/Rummy reuse close-fit icons).
const ICON_KEY = {
  GTN: 'gtn', BC: 'bc', XOX: 'xox', MATH: 'math', SUDOKU: 'sudoku', QUEENS: 'queens',
  TANGO: 'tango', ZIP: 'zip', PINPOINT: 'pinpoint', CROSSCLIMB: 'crossclimb',
  SPIN: 'spin', SOS: 'sos', RMCS: 'queens', RUMMY: 'chip', LUDO: 'ludo',
}

export default function HomeListPage() {
  const navigate = useNavigate()
  const { isRegistered, user } = useAuth()
  const { playerName, totalGames } = usePlayer()
  const [showDrawer, setShowDrawer] = useState(false)

  const name = isRegistered && user?.username ? user.username : playerName
  const games = user?.totalGames ?? totalGames
  const tier = getTierFromGames(games)

  function playGame(mode) {
    // Solo-only modes go straight to their page; the rest open the MP lobby.
    const game = GAMES.find(g => g.mode === mode)
    if (game?.solo) { navigate(`/play/${mode}`); return }
    navigate('/lobby', { state: { mode } })
  }

  return (
    <div className={styles.screen} id="main-content">
      <AmbientOrbs />
      {/* Top bar — hamburger LEFT, premium Home RIGHT */}
      <div className={styles.topBar}>
        <button
          className={styles.iconBtn}
          onClick={() => setShowDrawer(true)}
          aria-label="Menu"
          aria-haspopup="dialog"
        >
          <MenuIcon size={22} />
        </button>
        <button className={`${styles.iconBtn} ${styles.homeBtn}`} onClick={() => navigate('/')} aria-label="Home">
          <HomeIcon size={22} />
        </button>
      </div>

      {/* Greeting */}
      <div className={styles.hero}>
        <GameLogo variant="static" size={88} />
        <div className={styles.greeting}>
          <h1 className={styles.hello}>
            Ready, <span className={styles.name}>{name}</span>?
          </h1>
          <div className={styles.metaRow}>
            <span className={styles.tier}>{tier}</span>
            {isRegistered && user && <span className={styles.levelChip} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>LV {user.level ?? 1} · <CoinIcon size={14} /> {user.coins ?? 0}</span>}
            {games > 0 && <span className={styles.gamesCount}>{games} games played</span>}
            {!isRegistered && <span className={styles.guestTag}>Guest</span>}
          </div>
        </div>
      </div>

      {/* Game list */}
      <div className={styles.sectionLabel}>Choose a game</div>
      <div className={styles.gameList}>
        {GAMES.filter(g => !g.hidden).map((g, i) => (
          <button
            key={g.mode}
            className={`${styles.gameCard} anim-slide-up ${g.mode === 'LUDO' ? styles.ludoCard : ''}`}
            style={{ animationDelay: `${i * 70}ms`, '--accent': g.accent }}
            onClick={() => playGame(g.mode)}
          >
            <span className={styles.gameIcon}><GameIcon icon={ICON_KEY[g.mode]} size={52} /></span>
            <div className={styles.gameText}>
              <span className={styles.gameName}>{g.name}</span>
              <span className={styles.gameDesc}>{g.desc}</span>
              {g.chips && (
                <span className={styles.chipRow}>
                  {g.chips.map((c, j) => (
                    <span key={j} className={styles.metaChip}>
                      {c.icon === 'users' && <UsersIcon size={12} />}
                      {c.icon === 'bot' && <BotIcon size={12} />}
                      {c.icon === 'clock' && <ClockIcon size={12} />}
                      {c.label}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <span className={styles.playArrow}>▶</span>
          </button>
        ))}
      </div>

      {/* Watch live games */}
      <button className={styles.watchLive} onClick={() => navigate('/spectate')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <EyeIcon size={18} /> Watch Live Games →
      </button>

      {/* Guest upsell */}
      {!isRegistered && (
        <button className={styles.upsell} onClick={() => navigate('/register')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <SkullIcon size={18} /> Create an account to save your stats & climb the leaderboard →
        </button>
      )}

      <MoreDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />
    </div>
  )
}
