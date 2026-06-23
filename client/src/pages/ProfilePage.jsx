import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import Avatar from '../components/avatar/Avatar.jsx'
import AvatarPicker from '../components/avatar/AvatarPicker.jsx'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import { getTierFromGames } from '../utils/personality.js'
import { levelProgress } from '../utils/progression.js'
import { EditIcon, CoinIcon, MedalIcon, TrophyIcon, UsersIcon, BagIcon } from '../components/icons/Icons.jsx'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, isRegistered, logout, refreshUser } = useAuth()
  const { totalGames, gtnWins, playerName, playerId, avatar, setAvatar } = usePlayer()
  const [pickerOpen, setPickerOpen] = useState(false)

  // Pull live stats from the DB whenever the profile opens
  useEffect(() => {
    if (isRegistered) refreshUser()
  }, [isRegistered, refreshUser])

  const displayName = user?.username || playerName
  const games = user?.totalGames ?? totalGames
  const tier = getTierFromGames(games)

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  if (!isRegistered) {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={styles.page}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>← Back</button>
          <div className={styles.guestBanner}>
            <button className={styles.avatarBtn} onClick={() => setPickerOpen(o => !o)} aria-label="Change avatar" title="Change avatar">
              <Avatar id={avatar} seed={playerId} name={playerName} size={80} ring="cyan" />
              <span className={styles.editPip} aria-hidden="true"><EditIcon size={12} /></span>
            </button>
            {pickerOpen && (
              <div className={styles.pickerCard}>
                <p className={styles.pickerTitle}>Pick your avatar</p>
                <AvatarPicker value={avatar} onPick={(id) => { setAvatar(id); setPickerOpen(false) }} />
              </div>
            )}
            <h2>You're playing as a guest.</h2>
            <p className={styles.nudgeText}>
              Register to save your stats, earn badges, challenge friends, and appear on leaderboards. Your current progress will carry over.
            </p>
            <Link to="/register" className="btn btn-juice btn-lg" style={{ width: '100%', textAlign: 'center' }}>
              Create Account
            </Link>
            <Link to="/login" className="btn btn-ghost" style={{ width: '100%', textAlign: 'center' }}>
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={styles.page}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
        </div>

        <div className={styles.avatar}>
          <button className={styles.avatarBtn} onClick={() => setPickerOpen(o => !o)} aria-label="Change avatar" title="Change avatar">
            <Avatar id={avatar} seed={playerId} name={displayName} size={96} ring={user?.equippedFrame || 'cyan'} />
            <span className={styles.editPip} aria-hidden="true"><EditIcon size={12} /></span>
          </button>
          <div className={styles.identity}>
            <h1 className={styles.username}>{displayName}</h1>
            {user?.equippedTitle && <span className={styles.equippedTitle}>{user.equippedTitle}</span>}
            <span className={`badge badge-pink`}>{tier}</span>
          </div>
        </div>

        {/* Level / XP / coins */}
        {(() => {
          const xp = user?.xp ?? 0
          const lp = levelProgress(xp)
          return (
            <div className={styles.levelCard}>
              <div className={styles.levelTop}>
                <span className={styles.levelBadge}>LV {user?.level ?? lp.level}</span>
                <span className={styles.coinsChip} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CoinIcon size={15} /> {user?.coins ?? 0}</span>
              </div>
              <div className={styles.xpTrack}><div className={styles.xpFill} style={{ width: `${lp.pct}%` }} /></div>
              <div className={styles.xpMeta}>{xp} XP · {Math.max(0, lp.nextLevelXp - xp)} to level {lp.level + 1}</div>
            </div>
          )
        })()}

        {pickerOpen && (
          <div className={styles.pickerCard}>
            <p className={styles.pickerTitle}>Pick your avatar</p>
            <AvatarPicker value={avatar} onPick={(id) => { setAvatar(id); setPickerOpen(false) }} />
          </div>
        )}

        <div className={styles.statsGrid}>
          <StatCard label="Total Games" value={games} />
          <StatCard label="GTN Wins" value={user?.gtnWins ?? gtnWins} />
          <StatCard label="B&C Wins" value={user?.bcWins ?? 0} />
          <StatCard label="XOX Wins" value={user?.xoxWins ?? 0} />
          <StatCard label="Math Wins" value={user?.mathWins ?? 0} />
          <StatCard label="Sudoku Wins" value={user?.sudokuWins ?? 0} />
          <StatCard label="Rummy Wins" value={user?.rummyWins ?? 0} />
          <StatCard label="Tier" value={tier} text />
        </div>

        <div className={styles.links}>
          <Link to="/badges" className={styles.navBtn}>
            <span className={`${styles.navIcon} ${styles.navBadges}`}><MedalIcon size={20} /></span>
            <span className={styles.navLabel}>My Badges</span>
            <span className={styles.navChev} aria-hidden="true">›</span>
          </Link>
          <Link to="/leaderboard" className={styles.navBtn}>
            <span className={`${styles.navIcon} ${styles.navBoard}`}><TrophyIcon size={20} /></span>
            <span className={styles.navLabel}>Leaderboard</span>
            <span className={styles.navChev} aria-hidden="true">›</span>
          </Link>
          <Link to="/friends" className={styles.navBtn}>
            <span className={`${styles.navIcon} ${styles.navFriends}`}><UsersIcon size={20} /></span>
            <span className={styles.navLabel}>Friends</span>
            <span className={styles.navChev} aria-hidden="true">›</span>
          </Link>
          <Link to="/shop" className={styles.navBtn}>
            <span className={`${styles.navIcon} ${styles.navShop}`}><BagIcon size={20} /></span>
            <span className={styles.navLabel}>Shop</span>
            <span className={styles.navChev} aria-hidden="true">›</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, text }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${text ? styles.textValue : ''}`}>{value}</span>
    </div>
  )
}
