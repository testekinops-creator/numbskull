import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { SkeletonBadgeGrid } from '../components/Skeleton.jsx'
import { ErrorState } from '../components/States.jsx'
import styles from './BadgesPage.module.css'

const EARNED_KEY = 'ns_badges_earned'

export default function BadgesPage() {
  const navigate = useNavigate()
  const [badges, setBadges] = useState([])
  const [loadingBadges, setLoadingBadges] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [earned] = useState(() => {
    try { return JSON.parse(localStorage.getItem(EARNED_KEY) || '[]') } catch { return [] }
  })

  const load = useCallback(() => {
    setLoadingBadges(true); setLoadError(false)
    api.get('/badges')
      .then(data => setBadges(data.badges || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoadingBadges(false))
  }, [])

  useEffect(() => { load() }, [load])

  const earnedSet = new Set(earned)
  const earnedCount = badges.filter(b => earnedSet.has(b.slug)).length

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className={styles.title}>Badges</h1>
          <span className={`badge badge-juice`}>{earnedCount}/{badges.length}</span>
        </div>

        {loadingBadges && <SkeletonBadgeGrid />}
        {loadError && !loadingBadges && (
          <ErrorState message="Couldn't load badges." onRetry={load} />
        )}
        <div className={styles.grid}>
          {!loadError && badges.map(b => {
            const unlocked = earnedSet.has(b.slug)
            return (
              <div key={b.slug} className={`${styles.badge} ${unlocked ? styles.unlocked : styles.locked}`} title={b.description}>
                <span className={styles.badgeIcon}>{unlocked ? b.icon : '🔒'}</span>
                <span className={styles.badgeName}>{b.name}</span>
                {unlocked && <span className={styles.badgeDesc}>{b.description}</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
