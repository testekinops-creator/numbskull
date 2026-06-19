import { useEffect } from 'react'
import CountUp from 'react-countup'
import styles from './Pinpoint.module.css'
import { useHaptic } from '../../hooks/useHaptic.js'

// Pure presentational Pinpoint view. Both players see the same clues revealed one
// at a time and pick the connecting category from four options. Answer on fewer
// clues = more points. No game logic lives here — the parent (MatchRoom) owns it.
//   round   : { index, clues, options, revealed, total }
//   reveal  : { answer, byMe, correct, points, timeout, bothWrong } | null
//   locked  : boolean   (round resolved OR I've already guessed wrong → disable)
//   myLocked: boolean   (I guessed wrong but the round is still live)
//   oppLocked, oppName, myChoice, myScore, oppScore
export default function Pinpoint({
  round, myScore = 0, oppScore = 0, oppName = 'Opponent',
  onAnswer, locked, myLocked = false, oppLocked = false, myChoice, reveal,
}) {
  const { buzz } = useHaptic()

  useEffect(() => {
    if (reveal?.byMe) buzz(reveal.correct ? 'correct' : 'wrong')
  }, [reveal, buzz])

  if (!round) return null
  const { index, clues = [], options = [], revealed = clues.length, total } = round
  const worth = reveal ? 0 : Math.max(1, 6 - revealed)   // points a correct guess earns right now

  return (
    <div className={styles.wrap}>
      {/* HUD */}
      <div className={styles.hud}>
        <div className={`${styles.scoreChip} ${styles.me}`}>
          <span className={styles.scoreLabel}>You</span>
          <span className={styles.scoreVal}><CountUp end={myScore} duration={0.5} preserveValue /></span>
        </div>
        <div className={styles.qCount}>Round {Math.min(index + 1, total)} / {total}</div>
        <div className={`${styles.scoreChip} ${styles.opp}`}>
          <span className={styles.scoreLabel}>{oppName}</span>
          <span className={styles.scoreVal}><CountUp end={oppScore} duration={0.5} preserveValue /></span>
        </div>
      </div>

      {/* Worth pill — counts down as more clues appear */}
      <div className={styles.worthRow}>
        <span className={styles.prompt}>What connects these?</span>
        {!reveal && <span key={revealed} className={`${styles.worth} anim-msg`}>💎 +{worth}</span>}
      </div>

      {/* Clue list — revealed clues plus dim placeholders for the rest */}
      <div className={styles.clues}>
        {Array.from({ length: 5 }).map((_, i) => {
          const shown = i < clues.length
          return (
            <div key={i} className={`${styles.clue} ${shown ? styles.clueShown : styles.cluePending} ${shown && i === clues.length - 1 ? 'anim-msg' : ''}`}>
              <span className={styles.clueNum}>{i + 1}</span>
              <span className={styles.clueText}>{shown ? clues[i] : '• • •'}</span>
            </div>
          )
        })}
      </div>

      {/* Options — category names */}
      <div className={styles.options}>
        {options.map((opt, i) => {
          let cls = styles.option
          if (reveal) {
            if (opt === reveal.answer) cls += ` ${styles.correct}`
            else if (opt === myChoice && reveal.byMe && !reveal.correct) cls += ` ${styles.wrong}`
          } else if (opt === myChoice && myLocked) {
            cls += ` ${styles.wrong}`   // my wrong pick stays marked while the round runs on
          }
          return (
            <button key={i} className={cls} onClick={() => { buzz('tap'); onAnswer?.(opt) }} disabled={locked}>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Status / reveal banner */}
      <div key={reveal ? `rv${index}` : (myLocked ? `lk${index}` : 'rv')} className={`${styles.revealRow} ${reveal || myLocked ? 'anim-msg' : ''}`}>
        {reveal ? (
          reveal.timeout ? (
            <span className={styles.revealNeutral}>⏱️ Time! It was <b>{reveal.answer}</b>.</span>
          ) : reveal.bothWrong ? (
            <span className={styles.revealNeutral}>Both missed — it was <b>{reveal.answer}</b>.</span>
          ) : reveal.byMe ? (
            <span className={styles.revealGood}>✓ Got it! +{reveal.points}</span>
          ) : (
            <span className={styles.revealNeutral}>{oppName} pinned it (+{reveal.points}) — <b>{reveal.answer}</b></span>
          )
        ) : myLocked ? (
          <span className={styles.revealBad}>✗ Not that one — wait for the answer.</span>
        ) : oppLocked ? (
          <span className={styles.revealNeutral}>{oppName} guessed wrong — your chance!</span>
        ) : null}
      </div>
    </div>
  )
}
