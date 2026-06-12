import { useEffect, useRef } from 'react'
import CountUp from 'react-countup'
import styles from './GameOverCard.module.css'
import SkullMascot from '../skull/SkullMascot.jsx'
import { celebrateWin } from '../../utils/celebrate.js'

export default function GameOverCard({ won, draw, attempts, secret, optimalMoves, mode, onPlayAgain, onHome, multiplayer, scores, roast, stats }) {
  // Capped at 100% — beating the worst-case optimal (e.g. 9 guesses vs 10) is a
  // perfect run, not "111%".
  const efficiency = optimalMoves && attempts
    ? Math.min(100, Math.round((optimalMoves / attempts) * 100))
    : null

  const isWin  = won && !draw
  const showGuessCount = (mode === 'GTN' || mode === 'BC') && attempts != null

  // Fire the confetti cannons once on a win (reduce-motion aware).
  useEffect(() => { if (isWin) celebrateWin() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // Shake lives on a wrapper: the card itself runs its `cardEnter` animation,
    // and two `animation` declarations on one element override each other.
    <div className={!draw ? 'anim-screen-shake' : undefined} style={!draw ? { animationDelay: '0.12s' } : undefined}>
    <div className={`${styles.card} ${draw ? styles.loseCard : isWin ? styles.winCard : styles.loseCard}`}>

      {/* Win confetti is fired imperatively via canvas-confetti (see effect). */}

      {/* Skull with animation */}
      <div className={`${styles.skullWrap} ${isWin ? styles.skullWin : styles.skullLose}`}>
        <SkullMascot
          expression={draw ? 'grudging' : isWin ? 'impressed' : 'annoyed'}
          size={100}
          glow={isWin}
        />
        {isWin && <div className={styles.winRing} />}
      </div>

      {/* Result text */}
      <div className={styles.resultText}>
        {draw ? (
          <>
            <span className={styles.loseEmoji}>🤝</span>
            <h2 className={styles.loseTitle}>It's a Draw!</h2>
          </>
        ) : isWin ? (
          <>
            <span className={styles.winEmoji}>🎉</span>
            <h2 className={styles.winTitle}>You Won!</h2>
          </>
        ) : (
          <>
            <span className={styles.loseEmoji}>💀</span>
            <h2 className={styles.loseTitle}>Game Over</h2>
          </>
        )}
      </div>

      {/* Mode-specific roast */}
      {roast && (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', textAlign: 'center', margin: '2px auto 4px', maxWidth: '34ch' }}>
          &ldquo;{roast}&rdquo;
        </p>
      )}

      {/* Stats row — centered. A caller can pass a custom `stats` array
          (e.g. solo Sudoku time / mistakes / best) rendered as stat boxes. */}
      <div className={styles.statsRow}>
        {Array.isArray(stats) && stats.map((s, i) => (
          <StatBox key={i} label={s.label} value={s.value} highlight={s.highlight} accent={s.accent} />
        ))}
        {showGuessCount && <StatBox label="Guesses" value={attempts} />}
        {mode === 'GTN' && optimalMoves && (
          <StatBox label="Optimal" value={optimalMoves} />
        )}
        {efficiency !== null && (
          <StatBox label="Efficiency" value={`${efficiency}%`} highlight={efficiency >= 80} />
        )}
        {secret && (
          <StatBox label="Answer" value={secret} accent />
        )}
      </div>

      {/* Multiplayer scores */}
      {multiplayer && scores && scores.length === 2 && (
        <div className={styles.scores}>
          {scores.map(p => {
            const isWinner = p.score === Math.max(...scores.map(s => s.score))
            return (
              <div key={p.id} className={styles.scoreItem}>
                <span className={styles.scoreName}>
                  {p.isYou ? 'You' : p.name}
                  {isWinner ? ' 👑' : ''}
                </span>
                <span
                  className={styles.scoreVal}
                  style={{ color: isWinner ? 'var(--color-juice)' : 'var(--color-text-secondary)' }}
                >
                  <CountUp end={p.score} duration={0.9} />
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions — single player only (multiplayer uses RematchPrompt) */}
      {onPlayAgain && (
        <div className={styles.actions}>
          <button className={`btn btn-juice btn-lg ${styles.playAgainBtn}`} onClick={onPlayAgain}>
            Play Again
          </button>
          <button className={`btn btn-ghost ${styles.homeBtn}`} onClick={onHome}>
            Home
          </button>
        </div>
      )}
    </div>
    </div>
  )
}

function StatBox({ label, value, highlight, accent }) {
  return (
    <div className={`${styles.statBox} ${highlight ? styles.statHighlight : ''} ${accent ? styles.statAccent : ''}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {typeof value === 'number' ? <CountUp end={value} duration={0.8} /> : value}
      </span>
    </div>
  )
}

/* ── Confetti ────────────────────────────────────────────────────── */
const CONFETTI_COLORS = ['#00F5FF', '#FF3E8A', '#FFD740', '#7C4DFF', '#00E676']
const PARTICLE_COUNT  = 28

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <span
          key={i}
          className={styles.confettiDot}
          style={{
            '--x':     `${(Math.random() * 200 - 100).toFixed(0)}px`,
            '--y':     `${-(Math.random() * 120 + 60).toFixed(0)}px`,
            '--rot':   `${(Math.random() * 720).toFixed(0)}deg`,
            '--delay': `${(Math.random() * 0.5).toFixed(2)}s`,
            '--color': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            '--size':  `${(Math.random() * 6 + 5).toFixed(0)}px`,
          }}
        />
      ))}
    </div>
  )
}
