import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { SkeletonLeaderboard } from '../components/Skeleton.jsx'
import styles from './LeaderboardPage.module.css'

const TABS = [
  { id: 'gtn_alltime', label: '🎯 GTN All-Time' },
  { id: 'bc_alltime',  label: '🐂 B&C All-Time' },
  { id: 'gtn_weekly',  label: '📅 GTN Weekly' },
  { id: 'bc_weekly',   label: '📅 B&C Weekly' },
  { id: 'daily',       label: '☀️ Today' },
]

export default function LeaderboardPage() {
  const navigate = useNavigate()
  const { type: paramType } = useParams()
  const { playerId } = usePlayer()
  const [tab, setTab] = useState(paramType || 'gtn_alltime')
  const [entries, setEntries] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = tab === 'daily' ? `?date=${new Date().toISOString().slice(0,10)}` : ''
    api.get(`/leaderboard/${tab}${params}`)
      .then(data => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))

    api.get(`/leaderboard/${tab}/rank/${playerId}`)
      .then(data => setMyRank(data.rank))
      .catch(() => setMyRank(null))
  }, [tab, playerId])

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className={styles.title}>Leaderboard</h1>
          {myRank && <span className={`badge badge-juice`}>#{myRank}</span>}
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.active : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <SkeletonLeaderboard />}

        {!loading && entries.length === 0 && (
          <p className={styles.empty}>No scores yet. Be the first.</p>
        )}

        {!loading && entries.length > 0 && (
          <ol className={styles.list}>
            {entries.map((e, i) => (
              <li key={e.playerId} className={`${styles.entry} ${e.playerId === playerId ? styles.me : ''}`}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{e.playerName}</span>
                <span className={styles.score}>{e.score.toLocaleString()}</span>
                <span className={styles.attempts}>{e.attempts} guesses</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
