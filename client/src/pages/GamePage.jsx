import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import { recordGameForBadges } from '../services/badges.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import PressureMeter from '../components/game/PressureMeter.jsx'
import GuessList from '../components/game/GuessList.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import DifficultyPicker from '../components/game/DifficultyPicker.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { getTierFromGames, getSkullExpression } from '../utils/personality.js'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import styles from './GamePage.module.css'

const MODE_LABELS = { GTN: 'Guess The Number', BC: 'Bulls & Cows' }

export default function GamePage() {
  const { mode } = useParams()
  const navigate = useNavigate()
  const { state, startGame, submitGuess } = useGame()
  const { isRegistered, updateUser } = useAuth()
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [picked, setPicked] = useState(null)   // chosen difficulty (gates start)
  const inputRef = useRef(null)
  const recordedRef = useRef(false)  // guard so each game records only once

  const validMode = mode === 'GTN' || mode === 'BC'

  useEffect(() => {
    if (!validMode) navigate('/home')   // start is deferred until difficulty is picked
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(difficulty) {
    setPicked(difficulty)
    const range = mode === 'GTN' ? { easy: 100, medium: 1000, hard: 10000 }[difficulty] : undefined
    startGame({ mode, difficulty, range })
  }

  useEffect(() => {
    if (state.phase === 'PLAYING') {
      inputRef.current?.focus()
      recordedRef.current = false   // new game started — allow recording again
    }
  }, [state.phase])

  // On game over: award badges (everyone) + record stats (registered only)
  useEffect(() => {
    if (state.phase === 'GAME_OVER' && !recordedRef.current) {
      recordedRef.current = true
      const won = !!state.won
      const optimal = mode === 'GTN' && won && state.lastResult?.optimalMoves != null
        && state.attempts <= state.lastResult.optimalMoves
      recordGameForBadges({ mode, won, optimal, gtnRange1000Win: mode === 'GTN' && won })
      if (isRegistered) {
        api.post('/game/record', { mode, won })
          .then(d => { if (d.user) updateUser(d.user) })
          .catch(() => {})
      }
    }
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = state.lastResult
    if (!r) return
    if (r.correct || r.won) {
      playWin()
      buzz('correct')
    } else if (r.valid === false) {
      buzz('error')
    } else if (r.over) {
      playLose()
      buzz('wrong')
    } else {
      playTone(r.proximity ?? 0)
      buzz('wrong')
    }
  }, [state.lastResult]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e) {
    e.preventDefault()
    unlock()  // prime audio within the user gesture
    const val = inputValue.trim()
    if (!val) return

    if (mode === 'GTN') {
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1 || n > state.range) {
        setInputError(`Enter a number between 1 and ${state.range}`)
        triggerShake()
        return
      }
    } else {
      if (!/^\d{6}$/.test(val)) {
        setInputError('Enter exactly 6 digits')
        triggerShake()
        return
      }
    }

    setInputError('')
    setInputValue('')
    submitGuess(mode === 'GTN' ? parseInt(val, 10) : val)
  }

  function triggerShake() {
    setShaking(true)
    setTimeout(() => setShaking(false), 500)
    buzz('error')
  }

  const tier = getTierFromGames(state.totalGames)
  const expression = getSkullExpression(state.lastResult, state.phase)

  const placeholder = mode === 'GTN'
    ? `1 – ${state.range}`
    : '6 digits'

  if (state.phase === 'IDLE') {
    return (
      <div className="screen">
        <div className={`panel ${styles.gamePage}`}>
          <div className={styles.header}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
            <span className={`badge badge-juice`}>{MODE_LABELS[mode]}</span>
            <span />
          </div>
          {picked
            ? <div className={styles.loading}>Loading…</div>
            : <DifficultyPicker mode={mode} onSelect={choose} />}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {!tutorialDone && <TutorialOverlay mode={mode} onDone={() => setTutorialDone(true)} />}
      <div className={`panel ${styles.gamePage}`}>
        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>
            ← Back
          </button>
          <span className={`badge badge-juice`}>{MODE_LABELS[mode]}</span>
          <span className={styles.attempt}>
            {state.attempts > 0 ? `Guess #${state.attempts + 1}` : 'Guess #1'}
          </span>
        </div>

        {/* Skull */}
        <div className={styles.skullArea}>
          <SkullMascot expression={expression} size={100} />
          {state.roast && (
            <p className={`${styles.roastMsg} anim-slide-up`} key={state.roast}>
              &ldquo;{state.roast}&rdquo;
            </p>
          )}
          <span className={`badge badge-pink ${styles.tierBadge}`}>{tier}</span>
        </div>

        <PressureMeter active={state.phase === 'PLAYING'} />

        {/* Input */}
        {/* B&C legend — single player */}
        {state.phase === 'PLAYING' && mode === 'BC' && (
          <div className={styles.bcLegend}>
            <div className={styles.bcItem}>
              <span>🐂</span>
              <span><strong>Bull</strong> — right digit, right position</span>
            </div>
            <div className={styles.bcItem}>
              <span>🐄</span>
              <span><strong>Cow</strong> — right digit, wrong position</span>
            </div>
          </div>
        )}

        {state.phase === 'PLAYING' && (
          <form className={styles.inputArea} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className={`input ${shaking ? 'anim-shake' : ''}`}
              type={mode === 'GTN' ? 'number' : 'text'}
              inputMode="numeric"
              pattern={mode === 'GTN' ? '[0-9]*' : '[0-9]{6}'}
              maxLength={mode === 'GTN' ? String(state.range).length : 6}
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setInputError('') }}
              placeholder={placeholder}
              autoComplete="off"
              aria-label="Your guess"
            />
            {inputError && <p className={styles.fieldError}>{inputError}</p>}
            <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }}>
              Guess
            </button>
          </form>
        )}

        {/* Guess history */}
        <GuessList guesses={state.guesses} mode={mode} />

        {/* Game Over */}
        {state.phase === 'GAME_OVER' && (
          <GameOverCard
            won={state.won}
            attempts={state.attempts}
            secret={state.lastResult?.secret}
            optimalMoves={state.lastResult?.optimalMoves}
            mode={mode}
            onPlayAgain={() => startGame({ mode, difficulty: state.difficulty, range: state.range })}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
    </div>
  )
}
