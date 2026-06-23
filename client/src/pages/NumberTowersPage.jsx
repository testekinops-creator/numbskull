import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameIcon from '../components/icons/GameIcon.jsx'
import styles from './NumberTowersPage.module.css'

export default function NumberTowersPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [state, setState] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.post('/game/start', { mode: 'NUMBER_TOWERS' }).then(data => {
      setSession(data)
      setState(data)
    })
  }, [])

  async function handlePlace(slot) {
    if (!session || state?.over) return
    setError('')
    try {
      const data = await api.post('/game/towers/place', { slot, sessionId: session.sessionId })
      if (!data.valid) { setError(data.error || 'Invalid placement'); return }
      setState(data)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDiscard() {
    if (!session || state?.over) return
    setError('')
    try {
      const data = await api.post('/game/towers/discard', { sessionId: session.sessionId })
      if (!data.valid) { setError(data.error || 'No discards left'); return }
      setState(prev => ({ ...prev, current: data.next, discardLeft: prev.discardLeft - 1 }))
    } catch (err) {
      setError(err.message)
    }
  }

  function restart() {
    api.post('/game/start', { mode: 'NUMBER_TOWERS' }).then(data => { setSession(data); setState(data) })
  }

  const expression = state?.won ? 'impressed' : state?.over ? 'annoyed' : 'neutral'
  const tower = state?.tower || Array(5).fill(null)
  const current = state?.current ?? session?.current

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <span className={`badge badge-juice`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon icon="towers" size={15} /> Number Towers</span>
          {state && <span className={styles.discards}>{state.discardLeft ?? 3} discards</span>}
        </div>

        <p className={styles.rule}>Fill 5 slots in ascending order (bottom = smallest).</p>

        <div className={styles.towerWrap}>
          {[...tower].reverse().map((val, revIdx) => {
            const slot = 4 - revIdx
            const isEmpty = val === null
            return (
              <button
                key={slot}
                className={`${styles.slot} ${isEmpty ? styles.empty : styles.filled} ${state?.over ? styles.disabled : ''}`}
                onClick={() => isEmpty && !state?.over && handlePlace(slot)}
                disabled={!isEmpty || state?.over}
                aria-label={isEmpty ? `Place ${current} in slot ${slot + 1}` : `Slot ${slot + 1}: ${val}`}
              >
                {isEmpty ? (
                  <span className={styles.slotHint}>Slot {slot + 1}</span>
                ) : (
                  <span className={styles.slotVal}>{val}</span>
                )}
              </button>
            )
          })}
        </div>

        {current != null && !state?.over && (
          <div className={styles.currentCard}>
            <span className={styles.currentLabel}>Current card</span>
            <span className={styles.currentVal}>{current}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleDiscard} disabled={!state?.discardLeft}>
              Discard ({state?.discardLeft ?? 3} left)
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {state?.over && (
          <div className={`card ${styles.result} anim-bounce-land`}>
            <SkullMascot expression={expression} size={72} />
            <h2 className={state.won ? styles.win : styles.lose}>
              {state.won ? `Tower built! Score: ${state.score}` : 'Tower collapsed.'}
            </h2>
            <div className={styles.finalTower}>
              {state.tower.map((v, i) => (
                <span key={i} className={`${styles.finalSlot} ${v !== null ? styles.ok : styles.missing}`}>
                  {v ?? '—'}
                </span>
              ))}
            </div>
            <div className={styles.resultActions}>
              <button className="btn btn-juice" onClick={restart}>Play Again</button>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>Home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
