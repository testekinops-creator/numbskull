import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import PressureMeter from '../components/game/PressureMeter.jsx'
import GuessList from '../components/game/GuessList.jsx'
import GameOverCard from '../components/game/GameOverCard.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import { getTierFromGames, getSkullExpression } from '../utils/personality.js'
import TutorialOverlay from '../components/tutorial/TutorialOverlay.jsx'
import styles from './GamePage.module.css'

const MODE_LABELS = { GTN: 'Guess The Number', BC: 'Bulls & Cows' }

export default function GamePage() {
  const { mode } = useParams()
  const navigate = useNavigate()
  const { state, startGame, submitGuess, bcUnlocked } = useGame()
  const { playTone } = useSound()
  const { buzz } = useHaptic()

  const [inputValue, setInputValue] = useState('')
  const [inputError, setInputError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [tutorialDone, setTutorialDone] = useState(false)
  const inputRef = useRef(null)

  const validMode = mode === 'GTN' || mode === 'BC'
  const locked = mode === 'BC' && !bcUnlocked

  useEffect(() => {
    if (!validMode || locked) { navigate('/'); return }
    startGame({ mode, difficulty: 'medium', range: 100 })
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.phase === 'PLAYING') inputRef.current?.focus()
  }, [state.phase])

  useEffect(() => {
    const r = state.lastResult
    if (!r) return
    if (r.correct || r.won) {
      playTone(r.proximity ?? 1)
      buzz('correct')
    } else if (r.valid === false) {
      buzz('error')
    } else {
      playTone(r.proximity ?? 0)
      buzz('wrong')
    }
  }, [state.lastResult]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e) {
    e.preventDefault()
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
      if (!/^\d{4}$/.test(val)) {
        setInputError('Enter exactly 4 digits')
        triggerShake()
        return
      }
      if (new Set(val).size !== 4) {
        setInputError('All digits must be different')
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
    : '4 unique digits'

  if (state.phase === 'IDLE') {
    return (
      <div className="screen">
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  return (
    <div className="screen">
      {!tutorialDone && <TutorialOverlay mode={mode} onDone={() => setTutorialDone(true)} />}
      <div className={`panel ${styles.gamePage}`}>
        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
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
              pattern={mode === 'GTN' ? '[0-9]*' : '[0-9]{4}'}
              maxLength={mode === 'GTN' ? 4 : 4}
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
            onPlayAgain={() => startGame({ mode, difficulty: 'medium', range: state.range })}
            onHome={() => navigate('/')}
          />
        )}
      </div>
    </div>
  )
}
