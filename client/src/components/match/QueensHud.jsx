import { useState, useEffect } from 'react'
import styles from './QueensHud.module.css'

// Race HUD for Queens: a shared countdown + every player's live progress (queen
// count only — never positions), with a ✅ + solve-time badge once they finish.
function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function QueensHud({ match, players = [], playerId }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const n = match.n
  const left = match.deadline ? match.deadline - now : null
  const low = left != null && left < 30_000

  // Sort: finishers first (by time), then by queens placed — mirrors the standings.
  const rows = [...players].sort((a, b) => {
    const sa = !!match.solved?.[a.id], sb = !!match.solved?.[b.id]
    if (sa !== sb) return sa ? -1 : 1
    if (sa) return (match.finishMs?.[a.id] ?? 0) - (match.finishMs?.[b.id] ?? 0)
    return (match.placed?.[b.id] ?? 0) - (match.placed?.[a.id] ?? 0)
  })

  return (
    <div className={styles.hud}>
      {left != null && <span className={`${styles.timer} ${low ? styles.low : ''}`}>⏳ {fmt(left)}</span>}
      <div className={styles.players}>
        {rows.map(p => {
          const solved = !!match.solved?.[p.id]
          const mine = p.id === playerId
          return (
            <span key={p.id} className={`${styles.pill} ${mine ? styles.you : ''} ${solved ? styles.done : ''}`}>
              {p.id === rows[0].id && solved ? '🥇 ' : ''}
              {mine ? 'You' : p.name}{' '}
              {solved
                ? `✅ ${fmt(match.finishMs?.[p.id] ?? 0)}`
                : `👑 ${match.placed?.[p.id] ?? 0}/${n}`}
            </span>
          )
        })}
      </div>
    </div>
  )
}
