import styles from './MathBattle.module.css'

// Pure presentational Math Battle view. Both the AI page and the multiplayer
// MatchRoom pass these props; neither game logic lives here.
//   question  : { index, prompt, options, total }
//   myScore   : number      oppScore : number      oppName : string
//   onAnswer  : (choice) => void
//   locked    : boolean      (question already answered/locked → disable)
//   myChoice  : the option value the player picked (for red/green coloring)
//   reveal    : { answer, byMe, correct, byOpp, timeout } | null
//   durationMs: timer-bar length (AI buzz window, or 15s in multiplayer)
export default function MathBattle({
  question, myScore = 0, oppScore = 0, oppName = 'Opponent',
  onAnswer, locked, myChoice, reveal, durationMs = 15000, solo = false,
}) {
  if (!question) return null
  const { index, prompt, options, total } = question

  return (
    <div className={styles.wrap}>
      {/* HUD */}
      <div className={styles.hud}>
        <div className={`${styles.scoreChip} ${styles.me}`}>
          <span className={styles.scoreLabel}>{solo ? 'Correct' : 'You'}</span>
          <span key={myScore} className={`${styles.scoreVal} anim-count`}>{myScore}</span>
        </div>
        <div className={styles.qCount}>Q {Math.min(index + 1, total)} / {total}</div>
        {solo ? (
          <div style={{ minWidth: 64 }} aria-hidden="true" />
        ) : (
          <div className={`${styles.scoreChip} ${styles.opp}`}>
            <span className={styles.scoreLabel}>{oppName}</span>
            <span key={oppScore} className={`${styles.scoreVal} anim-count`}>{oppScore}</span>
          </div>
        )}
      </div>

      {/* Timer bar — resets each question (keyed by index) */}
      <div className={styles.timerTrack}>
        <div
          key={index}
          className={styles.timerFill}
          style={{ animationDuration: `${durationMs}ms`, animationPlayState: locked ? 'paused' : 'running' }}
        />
      </div>

      {/* Prompt */}
      <div className={styles.prompt}>
        <span className={styles.promptText}>{prompt}</span>
        <span className={styles.eq}>= ?</span>
      </div>

      {/* Options */}
      <div className={styles.options}>
        {options.map((opt, i) => {
          let cls = styles.option
          if (reveal) {
            if (opt === reveal.answer) cls += ` ${styles.correct}`
            else if (opt === myChoice && reveal.byMe && !reveal.correct) cls += ` ${styles.wrong}`
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => onAnswer?.(opt)}
              disabled={locked}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {/* Reveal banner */}
      <div className={styles.revealRow}>
        {reveal && (
          reveal.timeout ? (
            <span className={styles.revealNeutral}>⏱️ Time! The answer was {reveal.answer}.</span>
          ) : reveal.byMe ? (
            reveal.correct
              ? <span className={styles.revealGood}>✓ Correct!{solo ? '' : ' +1'}</span>
              : <span className={styles.revealBad}>
                  {solo
                    ? `✗ Wrong — the answer was ${reveal.answer}`
                    : `✗ Wrong −1 — ${oppName} gets +1 (answer: ${reveal.answer})`}
                </span>
          ) : (
            reveal.correct
              ? <span className={styles.revealNeutral}>{oppName} buzzed first (+1 them) — answer {reveal.answer}</span>
              : <span className={styles.revealGood}>{oppName} missed — +1 you! (answer {reveal.answer})</span>
          )
        )}
      </div>
    </div>
  )
}
