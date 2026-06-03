import styles from './Skeleton.module.css'

export function Skeleton({ width = '100%', height = '1rem', radius = 'md', className = '' }) {
  return (
    <span
      className={`${styles.skeleton} ${styles[`radius_${radius}`]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, lastWidth = '60%' }) {
  return (
    <div className={styles.textGroup} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          width={i === lines - 1 ? lastWidth : '100%'}
          radius="sm"
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ rows = 2 }) {
  return (
    <div className={`card ${styles.card}`} aria-hidden="true">
      <Skeleton height="1.25rem" width="40%" radius="sm" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height="0.875rem" radius="sm" />
      ))}
    </div>
  )
}

export function SkeletonLeaderboard() {
  return (
    <div className={styles.leaderboard} aria-label="Loading leaderboard…" role="status">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={styles.lbRow}>
          <Skeleton width="1.5rem" height="1rem" radius="sm" />
          <Skeleton width="40%" height="1rem" radius="sm" />
          <Skeleton width="20%" height="1rem" radius="sm" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonBadgeGrid() {
  return (
    <div className={styles.badgeGrid} aria-label="Loading badges…" role="status">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`${styles.badgeCard}`}>
          <Skeleton width="2.5rem" height="2.5rem" radius="full" />
          <Skeleton width="60%" height="0.75rem" radius="sm" />
        </div>
      ))}
    </div>
  )
}
