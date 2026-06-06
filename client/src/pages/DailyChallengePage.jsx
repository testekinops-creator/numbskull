import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import RoastReportCard from '../components/engagement/RoastReportCard.jsx'
import { ErrorState } from '../components/States.jsx'
import styles from './DailyChallengePage.module.css'

const STORAGE_KEY = 'ns_daily_done'

export default function DailyChallengePage() {
  const navigate = useNavigate()
  const { playerId, playerName, totalGames } = usePlayer()
  const [challenge, setChallenge] = useState(null)
  const [guess, setGuess] = useState('')
  const [guesses, setGuesses] = useState([])
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [report, setReport] = useState(null)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const startRef = useRef(null)

  const load = useCallback(() => {
    setLoadError(false)
    api.get('/daily').then(data => {
      setChallenge(data)
      const done = localStorage.getItem(`${STORAGE_KEY}_${data.date}`)
      if (done) setAlreadyDone(true)
      else startRef.current = Date.now()
    }).catch(() => setLoadError(true))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleGuess(e) {
    e.preventDefault()
    if (!challenge || over) return
    const val = guess.trim()
    setGuess('')

    if (challenge.mode === 'GTN') {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1 || n > 100) { setError('Enter 1–100'); return }
      const newGuesses = [...guesses, parseInt(val, 10)]
      setGuesses(newGuesses)
      setError('')
      const secret = challenge._secret || (await fetchSecret(challenge.date))
      if (n === secret) await finish(newGuesses, true, secret)
    } else {
      if (!/^\d{4}$/.test(val) || new Set(val).size !== 4) { setError('4 unique digits'); return }
      const newGuesses = [...guesses, val]
      setGuesses(newGuesses)
      setError('')
    }
  }

  async function finish(finalGuesses, didWin, secret) {
    const timeMs = startRef.current ? Date.now() - startRef.current : 0
    setOver(true)
    setWon(didWin)
    localStorage.setItem(`${STORAGE_KEY}_${challenge.date}`, '1')
    const rep = {
      mode: challenge.mode,
      secret: String(secret),
      guesses: finalGuesses,
      timeMs,
    }
    setReport(rep)
    if (didWin) {
      await api.post('/daily/submit', { attempts: finalGuesses.length, won: true, timeMs, playerId, playerName })
    }
  }

  async function fetchSecret(date) {
    return null
  }

  if (loadError) {
    return (
      <div className="screen">
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <ErrorState message="Couldn't load today's challenge." onRetry={load} />
        </div>
      </div>
    )
  }

  if (!challenge) {
    return <div className="screen"><div className={styles.loading}>Loading today's challenge…</div></div>
  }

  if (alreadyDone) {
    return (
      <div className="screen">
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <div className={styles.doneBanner}>
            <SkullMascot expression="grudging" size={72} />
            <h2>You already played today.</h2>
            <p className={styles.hint}>Come back tomorrow. I'll be here. Judging you.</p>
            <button className="btn btn-ghost" onClick={() => navigate('/leaderboard/daily')}>
              See Today's Leaderboard
            </button>
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
          <div>
            <span className={`badge badge-juice`}>Daily {challenge.date}</span>
            <span className={`badge badge-pink`} style={{ marginLeft: 8 }}>{challenge.mode}</span>
          </div>
        </div>

        <div className={styles.skullArea}>
          <SkullMascot expression={over ? (won ? 'impressed' : 'annoyed') : 'neutral'} size={90} />
          <p className={styles.subtitle}>
            {challenge.mode === 'GTN'
              ? `Guess the number (1–100). Optimal: ${challenge.optimalMoves} guesses.`
              : 'Crack the 4-digit code. 10 guesses.'}
          </p>
        </div>

        {!over && (
          <form className={styles.form} onSubmit={handleGuess}>
            <input
              className="input"
              type={challenge.mode === 'GTN' ? 'number' : 'text'}
              inputMode="numeric"
              maxLength={4}
              placeholder={challenge.mode === 'GTN' ? '1 – 100' : '4 unique digits'}
              value={guess}
              onChange={e => { setGuess(e.target.value); setError('') }}
              aria-label="Your guess"
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }}>
              Guess #{guesses.length + 1}
            </button>
          </form>
        )}

        <ul className={styles.guessList}>
          {[...guesses].reverse().map((g, i) => (
            <li key={i} className={styles.guessItem}>
              <span className={styles.guessVal}>{g}</span>
            </li>
          ))}
        </ul>

        {over && report && (
          <RoastReportCard report={report} won={won} onClose={() => navigate('/')} />
        )}
      </div>
    </div>
  )
}
