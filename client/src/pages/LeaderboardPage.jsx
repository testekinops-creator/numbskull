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

const initial  = (name) => (name || '?').trim().charAt(0).toUpperCase()
const winRate  = (w, g) => (g > 0 ? Math.round((w / g) * 100) : 0)

// Monthly MULTIPLAYER leaderboard — ranked by wins this calendar month.
// (Global / regional / per-mode / weekly / all-time boards need the deferred
//  DB + backend; this is the premium redesign of the existing monthly board.)
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

  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

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
          <>
            {/* Podium — top 3 (centre = #1, crowned) */}
            <div className={styles.podium}>
              {top3[1] && <PodiumSpot place={2} e={top3[1]} myId={myId} />}
              {top3[0] && <PodiumSpot place={1} e={top3[0]} myId={myId} />}
              {top3[2] && <PodiumSpot place={3} e={top3[2]} myId={myId} />}
            </div>

            {/* Ranks 4+ */}
            {rest.length > 0 && (
              <ol ref={listRef} className={styles.list}>
                {rest.map((e, i) => (
                  <li key={e.entrantId} className={`${styles.entry} ${e.entrantId === myId ? styles.me : ''}`}>
                    <span className={styles.rank}>{i + 4}</span>
                    <span className={styles.avatar}>{initial(e.name)}</span>
                    <div className={styles.entryInfo}>
                      <span className={styles.name}>{e.name}</span>
                      <span className={styles.meta}>{e.games} games · {winRate(e.wins, e.games)}% win rate</span>
                    </div>
                    <span className={styles.score}>{e.wins} {e.wins === 1 ? 'win' : 'wins'}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PodiumSpot({ place, e, myId }) {
  const isMe  = e.entrantId === myId
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'
  return (
    <div className={`${styles.spot} ${styles['spot' + place]} ${isMe ? styles.spotMe : ''}`}>
      {place === 1 && <span className={styles.crown} aria-hidden="true">👑</span>}
      <span className={styles.spotAvatar}>{initial(e.name)}</span>
      <span className={styles.spotName}>{e.name}</span>
      <span className={styles.spotWins}>{e.wins} {e.wins === 1 ? 'win' : 'wins'}</span>
      <div className={styles.pedestal}>
        <span className={styles.pedestalMedal}>{medal}</span>
        <span className={styles.pedestalRank}>{place}</span>
      </div>
    </div>
  )
}
