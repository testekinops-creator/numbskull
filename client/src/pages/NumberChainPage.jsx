import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api.js'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GameIcon from '../components/icons/GameIcon.jsx'
import styles from './NumberChainPage.module.css'

const OPS = ['+', '-', '*', '/']

export default function NumberChainPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [state, setState] = useState(null)
  const [op, setOp] = useState('+')
  const [operand, setOperand] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.post('/game/start', { mode: 'NUMBER_CHAIN' }).then(data => {
      setSession(data)
      setState(data)
    })
  }, [])

  async function handleMove(e) {
    e.preventDefault()
    const n = parseInt(operand, 10)
    if (isNaN(n) || n < 1 || n > 100) { setError('Enter 1–100'); return }
    setError('')
    try {
      const data = await api.post('/game/chain/move', { op, operand: n, sessionId: session.sessionId })
      setState(data)
      setOperand('')
    } catch (err) {
      setError(err.message)
    }
  }

  function restart() {
    api.post('/game/start', { mode: 'NUMBER_CHAIN' }).then(data => { setSession(data); setState(data) })
  }

  const expression = state?.won ? 'impressed' : state?.over ? 'annoyed' : 'neutral'

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <span className={`badge badge-juice`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GameIcon icon="chain" size={15} /> Number Chain</span>
          {state && !state.over && (
            <span className={styles.movesLeft}>{state.movesLeft ?? '—'} moves left</span>
          )}
        </div>

        {state && (
          <>
            <div className={styles.targets}>
              <div className={styles.targetBox}>
                <span className={styles.tLabel}>Start</span>
                <span className={styles.tVal}>{session?.start}</span>
              </div>
              <span className={styles.arrow}>→</span>
              <div className={styles.targetBox}>
                <span className={styles.tLabel}>Target</span>
                <span className={`${styles.tVal} ${styles.juice}`}>{state.target}</span>
              </div>
            </div>

            <div className={styles.current}>
              <span className={styles.currentLabel}>Current</span>
              <span className={`${styles.currentVal} ${state.current === state.target ? styles.match : ''}`}>
                {state.current ?? session?.start}
              </span>
            </div>

            {state.moves?.length > 0 && (
              <ul className={styles.moveList}>
                {[...state.moves].reverse().slice(0, 5).map((m, i) => (
                  <li key={i} className={styles.moveItem}>
                    <span className={styles.moveBefore}>{m.before}</span>
                    <span className={styles.moveOp}>{m.op} {m.operand}</span>
                    <span className={styles.moveAfter}>{m.after}</span>
                  </li>
                ))}
              </ul>
            )}

            {!state.over && (
              <form className={styles.form} onSubmit={handleMove}>
                <div className={styles.opRow}>
                  {OPS.map(o => (
                    <button
                      key={o} type="button"
                      className={`${styles.opBtn} ${op === o ? styles.opActive : ''}`}
                      onClick={() => setOp(o)}
                    >{o}</button>
                  ))}
                </div>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1} max={100}
                  value={operand}
                  onChange={e => { setOperand(e.target.value); setError('') }}
                  placeholder="1–100"
                  aria-label="Operand"
                  autoFocus
                />
                {error && <p className={styles.error}>{error}</p>}
                <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }}>
                  Apply {op} {operand || '?'}
                </button>
              </form>
            )}

            {state.over && (
              <div className={`card ${styles.result} anim-bounce-land`}>
                <SkullMascot expression={expression} size={72} />
                <h2 className={state.won ? styles.win : styles.lose}>
                  {state.won ? `Reached ${state.target}!` : `Didn't make it.`}
                </h2>
                <p className={styles.finalVal}>Final: {state.current} / Target: {state.target}</p>
                <div className={styles.resultActions}>
                  <button className="btn btn-juice" onClick={restart}>Play Again</button>
                  <button className="btn btn-ghost" onClick={() => navigate('/')}>Home</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
