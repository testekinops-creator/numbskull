import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { api } from '../services/api.js'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { SkeletonLeaderboard } from '../components/Skeleton.jsx'
import styles from './LeaderboardPage.module.css'

function monthName(period) {
  if (!period) return ''
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function medal(i) {
  return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
}

// Monthly MULTIPLAYER leaderboard — ranked by wins this calendar month.
export default function LeaderboardPage() {
  const navigate = useNavigate()
  const [listRef] = useAutoAnimate()
  const { playerId } = usePlayer()
  const { user } = useAuth()
  const myId = user?.id || playerId

  const [period, setPeriod] = useState('')
  const [entries, setEntries] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/leaderboard')
      .then(data => { setEntries(data.entries || []); setPeriod(data.period) })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))

    api.get(`/leaderboard/rank/${encodeURIComponent(myId)}`)
      .then(data => setMyRank(data.rank))
      .catch(() => setMyRank(null))
  }, [myId])

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className={styles.title}>Leaderboard</h1>
          {myRank && <span className="badge badge-juice">#{myRank}</span>}
        </div>

        <div className={styles.sub}>
          <span className={styles.month}>🏆 {monthName(period)} · Multiplayer wins</span>
          <span className={styles.reset}>Resets at month end</span>
        </div>

        {loading && <SkeletonLeaderboard />}

        {!loading && entries.length === 0 && (
          <p className={styles.empty}>No multiplayer games yet this month. Win one to claim the top spot.</p>
        )}

        {!loading && entries.length > 0 && (
          <ol ref={listRef} className={styles.list}>
            {entries.map((e, i) => (
              <li key={e.entrantId} className={`${styles.entry} ${e.entrantId === myId ? styles.me : ''}`}>
                <span className={styles.rank}>{medal(i)}</span>
                <span className={styles.name}>{e.name}</span>
                <span className={styles.score}>{e.wins} {e.wins === 1 ? 'win' : 'wins'}</span>
                <span className={styles.attempts}>{e.games} games</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
