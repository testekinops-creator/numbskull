import { useState, useEffect, useRef } from 'react'
import styles from './SudokuMpHud.module.css'

// Premium multiplayer Sudoku HUD: per-player score + mistake meter, a live lead
// bar (you cyan vs rival pink), a combo flame, a points popup on each fill, and
// an end-game "N left!" tension cue. Pure presentation from `match`.
export default function SudokuMpHud({ match, playerId, opponent }) {
  const myScore   = match.scores?.[playerId] ?? 0
  const oppScore  = opponent ? (match.scores?.[opponent.id] ?? 0) : 0
  const myMiss    = match.mistakes?.[playerId] ?? 0
  const oppMiss   = opponent ? (match.mistakes?.[opponent.id] ?? 0) : 0
  const limit     = match.mistakeLimit
  const myCombo   = match.combo?.[playerId] ?? 0
  const left      = Math.max(0, (match.fillTarget ?? 0) - (match.correctCount ?? 0))
  const tension   = left > 0 && left <= 5

  // Lead bar split — clamp to [10,90]% so a runaway score never hides a sliver.
  const total = myScore + oppScore
  const rawPct = total > 0 ? (Math.max(0, myScore) / Math.max(1, Math.max(0, myScore) + Math.max(0, oppScore))) * 100 : 50
  const myPct = Math.min(90, Math.max(10, rawPct))

  // Floating points popup, fired whenever a NEW fill arrives (lastFill.ts changes).
  const [pop, setPop] = useState(null)
  const lastTs = useRef(0)
  useEffect(() => {
    const lf = match.lastFill
    if (!lf || lf.ts === lastTs.current || lf.gained == null) return
    lastTs.current = lf.ts
    const mine = lf.by === playerId
    setPop({ id: lf.ts, gained: lf.gained, combo: lf.combo, mine })
    const t = setTimeout(() => setPop(p => (p?.id === lf.ts ? null : p)), 1000)
    return () => clearTimeout(t)
  }, [match.lastFill, playerId])

  return (
    <div className={styles.hud}>
      <div className={styles.scoreRow}>
        <span className={`${styles.chip} ${styles.me}`}>
          You <b>{myScore}</b>
          {limit != null && <span className={`${styles.miss} ${myMiss >= limit - 1 ? styles.missDanger : ''}`}>❌{myMiss}/{limit}</span>}
        </span>

        <span className={`${styles.mid} ${tension ? styles.tension : ''}`}>
          {tension ? `🔥 ${left} left!` : `✅ ${match.correctCount}/${match.fillTarget}`}
        </span>

        <span className={styles.chip}>
          {opponent?.name || 'Opp'} <b>{oppScore}</b>
          {limit != null && opponent && <span className={`${styles.miss} ${oppMiss >= limit - 1 ? styles.missDanger : ''}`}>❌{oppMiss}/{limit}</span>}
        </span>
      </div>

      {/* Live lead bar */}
      <div className={styles.leadBar} role="img" aria-label={`You ${myScore}, ${opponent?.name || 'opponent'} ${oppScore}`}>
        <span className={styles.leadMine} style={{ width: `${myPct}%` }} />
        <span className={styles.leadTheirs} style={{ width: `${100 - myPct}%` }} />
        {myCombo >= 2 && <span className={styles.comboFlame}>🔥×{myCombo}</span>}
      </div>

      {/* Points popup */}
      {pop && pop.gained != null && (
        <span
          key={pop.id}
          className={`${styles.pop} ${pop.mine ? styles.popMine : styles.popTheirs} ${pop.gained < 0 ? styles.popBad : ''}`}
        >
          {pop.gained > 0 ? `+${pop.gained}` : pop.gained}
          {pop.gained > 1 && pop.combo >= 3 && ' 🔥'}
        </span>
      )}
    </div>
  )
}
