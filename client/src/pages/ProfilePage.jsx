import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import Avatar from '../components/avatar/Avatar.jsx'
import AvatarPicker from '../components/avatar/AvatarPicker.jsx'
import { getTierFromGames } from '../utils/personality.js'
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
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <div className={styles.guestBanner}>
            <button className={styles.avatarBtn} onClick={() => setPickerOpen(o => !o)} aria-label="Change avatar" title="Change avatar">
              <Avatar id={avatar} seed={playerId} name={playerName} size={80} ring="cyan" />
              <span className={styles.editPip} aria-hidden="true">✏️</span>
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
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
        </div>

        <div className={styles.avatar}>
          <button className={styles.avatarBtn} onClick={() => setPickerOpen(o => !o)} aria-label="Change avatar" title="Change avatar">
            <Avatar id={avatar} seed={playerId} name={displayName} size={96} ring="cyan" />
            <span className={styles.editPip} aria-hidden="true">✏️</span>
          </button>
          <div className={styles.identity}>
            <h1 className={styles.username}>{displayName}</h1>
            <span className={`badge badge-pink`}>{tier}</span>
          </div>
        </div>

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
          <StatCard label="Tier" value={tier} text />
        </div>

        <div className={styles.links}>
          <Link to="/badges" className="btn btn-ghost" style={{ width: '100%' }}>🏅 My Badges</Link>
          <Link to="/leaderboard" className="btn btn-ghost" style={{ width: '100%' }}>🏆 Leaderboard</Link>
          <Link to="/friends" className="btn btn-ghost" style={{ width: '100%' }}>👥 Friends</Link>
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
