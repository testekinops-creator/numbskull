import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import styles from './CountdownPage.module.css'

export default function CountdownPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    api.post('/game/start', { mode: 'COUNTDOWN' }).then(data => {
      setSession(data)
      setTimeLeft(60)
      inputRef.current?.focus()
    })
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (!session || result?.over) return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          handleTimeUp()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [session?.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session || result?.over || !expr.trim()) return
    setError('')
    try {
      const data = await api.post('/game/countdown/submit', {
        expression: expr.trim(),
        sessionId: session.sessionId,
      })
      setResult(data)
      if (data.over) clearInterval(timerRef.current)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleTimeUp() {
    if (!session || result?.over) return
    const data = await api.post('/game/countdown/timeup', { sessionId: session.sessionId }).catch(() => null)
    if (data) setResult(data)
  }

  const urgency = timeLeft <= 10 ? 'critical' : timeLeft <= 20 ? 'high' : 'normal'
  const expression = result?.won ? 'impressed' : result?.over ? 'annoyed' : 'judging'

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <span className={`badge badge-juice`}>🔢 Countdown</span>
          <span className={`${styles.timer} ${styles[urgency]}`}>{timeLeft}s</span>
        </div>

        {session && (
          <>
            <div className={styles.target}>
              <span className={styles.targetLabel}>Target</span>
              <span className={styles.targetNum}>{session.target}</span>
            </div>

            <div className={styles.numbers}>
              {session.numbers?.map((n, i) => (
                <button
                  key={i}
                  className={styles.numTile}
                  onClick={() => setExpr(e => e + n)}
                  disabled={result?.over}
                  aria-label={`Add ${n} to expression`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className={styles.ops}>
              {['+', '-', '*', '/', '(', ')'].map(op => (
                <button key={op} className={styles.opTile} onClick={() => setExpr(e => e + op)} disabled={result?.over}>
                  {op}
                </button>
              ))}
            </div>

            {!result?.over && (
              <form className={styles.form} onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  className="input"
                  value={expr}
                  onChange={e => { setExpr(e.target.value); setError('') }}
                  placeholder="Build an expression…"
                  aria-label="Expression"
                />
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formRow}>
                  <button type="button" className="btn btn-ghost" onClick={() => setExpr('')}>Clear</button>
                  <button type="submit" className="btn btn-juice" style={{ flex: 1 }}>Submit</button>
                </div>
              </form>
            )}
          </>
        )}

        {result?.over && (
          <div className={`card ${styles.resultCard} anim-bounce-land`}>
            <SkullMascot expression={expression} size={72} />
            <h2 className={result.won ? styles.win : styles.lose}>
              {result.won ? `${result.value} — Spot on!` : `Time's up.`}
            </h2>
            {!result.won && result.bestScore !== null && (
              <p className={styles.bestMsg}>Best: {result.bestScore} (off by {result.diff})</p>
            )}
            <p className={styles.targetMsg}>Target was <strong>{result.target}</strong></p>
            <div className={styles.resultActions}>
              <button className="btn btn-juice" onClick={() => { setResult(null); setSession(null); api.post('/game/start', { mode: 'COUNTDOWN' }).then(d => { setSession(d); setTimeLeft(60) }) }}>
                Play Again
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>Home</button>
            </div>
          </div>
        )}

        <div className={styles.skullArea}>
          <SkullMascot expression={expression} size={64} glow={false} />
        </div>
      </div>
    </div>
  )
}
