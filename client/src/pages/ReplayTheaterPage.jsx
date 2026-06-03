import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import styles from './ReplayTheaterPage.module.css'

export default function ReplayTheaterPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [featured, setFeatured] = useState([])
  const [replay, setReplay] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      api.get(`/replays/${id}`).then(d => { setReplay(d.replay); setLoading(false) }).catch(() => setLoading(false))
    } else {
      api.get('/replays/featured').then(d => { setFeatured(d.replays); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [id])

  if (loading) return <div className="screen"><div className={styles.loading}>Loading replays…</div></div>

  if (id && replay) {
    return (
      <div className="screen">
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/theater')}>← All Replays</button>
          <div className={styles.replayHeader}>
            <span className={`badge badge-juice`}>{replay.mode}</span>
            <h1 className={styles.playerName}>{replay.playerName}</h1>
            <span className={`badge badge-pink`}>{replay.guesses?.length} guesses</span>
          </div>
          <div className={styles.replayStats}>
            <div className={styles.stat}><span className={styles.sl}>Time</span><span className={styles.sv}>{replay.timeMs ? `${(replay.timeMs/1000).toFixed(1)}s` : '—'}</span></div>
            <div className={styles.stat}><span className={styles.sl}>Optimal</span><span className={styles.sv}>{replay.optimalMoves ?? '—'}</span></div>
            <div className={styles.stat}><span className={styles.sl}>Views</span><span className={styles.sv}>{replay.views}</span></div>
          </div>
          <div className={styles.guessList}>
            {replay.guesses?.map((g, i) => (
              <div key={i} className={styles.guessRow}>
                <span className={styles.guessNum}>#{i+1}</span>
                <span className={styles.guessVal}>{g}</span>
              </div>
            ))}
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
          <h1 className={styles.title}>🎬 Replay Theater</h1>
        </div>
        <p className={styles.sub}>Today's best games. Curated by the skull.</p>
        {featured.length === 0 && <p className={styles.empty}>No highlights yet. Play some games!</p>}
        <div className={styles.grid}>
          {featured.map(r => (
            <button key={r.id} className={`${styles.card} card`} onClick={() => navigate(`/theater/${r.id}`)}>
              <div className={styles.cardTop}>
                <span className={`badge badge-juice`}>{r.mode}</span>
                <span className={styles.cardViews}>👁 {r.views}</span>
              </div>
              <p className={styles.cardPlayer}>{r.playerName}</p>
              <div className={styles.cardStats}>
                <span>{r.guessCount} guesses</span>
                {r.optimalMoves && <span>optimal: {r.optimalMoves}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
