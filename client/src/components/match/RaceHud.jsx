import { useState, useEffect } from 'react'
import GameIcon from '../icons/GameIcon.jsx'
import { ClockIcon, MedalIcon, CheckIcon } from '../icons/Icons.jsx'
import styles from './RaceHud.module.css'

// Shared HUD for puzzle-race games (Queens, Tango, …): a countdown + every player's
// live progress (a count only — never positions), with a ✓ + solve-time badge once
// they finish. `iconKey` is the GameIcon glyph for this mode; `total` is the goal count.
function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RaceHud({ match, players = [], playerId, iconKey = 'queens', total }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const left = match.deadline ? match.deadline - now : null
  const low = left != null && left < 30_000

  // Finishers first (by time), then by progress — mirrors the final standings.
  const rows = [...players].sort((a, b) => {
    const sa = !!match.solved?.[a.id], sb = !!match.solved?.[b.id]
    if (sa !== sb) return sa ? -1 : 1
    if (sa) return (match.finishMs?.[a.id] ?? 0) - (match.finishMs?.[b.id] ?? 0)
    return (match.placed?.[b.id] ?? 0) - (match.placed?.[a.id] ?? 0)
  })

  return (
    <div className={styles.hud}>
      {left != null && (
        <span className={`${styles.timer} ${low ? styles.low : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ClockIcon size={13} /> {fmt(left)}
        </span>
      )}
      <div className={styles.players}>
        {rows.map(p => {
          const solved = !!match.solved?.[p.id]
          const mine = p.id === playerId
          const leader = p.id === rows[0].id && solved
          return (
            <span key={p.id} className={`${styles.pill} ${mine ? styles.you : ''} ${solved ? styles.done : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {leader && <MedalIcon size={13} style={{ color: '#FFD740' }} />}
              {mine ? 'You' : p.name}
              {solved
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckIcon size={13} /> {fmt(match.finishMs?.[p.id] ?? 0)}</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GameIcon icon={iconKey} size={14} /> {match.placed?.[p.id] ?? 0}/{total}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
