import { useState } from 'react'
import QueensBoard from './QueensBoard.jsx'
import TangoBoard from './TangoBoard.jsx'
import ZipBoard from './ZipBoard.jsx'
import CrossclimbBoard from './CrossclimbBoard.jsx'
import { CheckIcon, FlagIcon, EyeIcon, BulbIcon } from '../icons/Icons.jsx'
import styles from './RaceWatch.module.css'

// Once you've finished (solved or gave up) a race, watch the other players' boards
// fill in live. The server sends DONE players everyone's boards (match.boards), so
// this just renders the selected opponent's board read-only + a tab to switch.
export default function RaceWatch({ match, players = [], playerId, mode, onHighlight }) {
  const opponents = players.filter(p => p.id !== playerId)
  const isDone = (id) => !!(match.solved?.[id] || match.gaveUp?.[id])
  const total = mode === 'QUEENS' ? match.n : mode === 'CROSSCLIMB' ? Math.max(1, (match.len || (match.words?.length || 1)) - 1) : match.n * match.n
  // Still-racing opponents first (more interesting to watch), then by progress.
  const ordered = [...opponents].sort((a, b) => {
    if (isDone(a.id) !== isDone(b.id)) return isDone(a.id) ? 1 : -1
    return (match.placed?.[b.id] ?? 0) - (match.placed?.[a.id] ?? 0)
  })

  const [sel, setSel] = useState(null)
  const watchId = ordered.some(p => p.id === sel) ? sel : ordered[0]?.id
  const watched = ordered.find(p => p.id === watchId)

  if (!watched) {
    return <p className={styles.note}>You're done! Nobody else to watch.</p>
  }

  const board = match.boards?.[watchId] || []
  const status = (id) => match.solved?.[id] ? <CheckIcon size={13} /> : match.gaveUp?.[id] ? <FlagIcon size={13} /> : `${match.placed?.[id] ?? 0}/${total}`
  // You can only point cells out to someone who's STILL solving (server enforces this too).
  const canPoint = !!onHighlight && !isDone(watchId)
  const point = canPoint ? (i) => onHighlight(watchId, i) : undefined
  const hl = match.highlights?.[watchId] || []

  const renderBoard = () => {
    if (mode === 'QUEENS') return <QueensBoard n={match.n} regions={match.regions} board={board} onPlace={() => {}} disabled highlights={hl} onHighlight={point} />
    if (mode === 'TANGO')  return <TangoBoard n={match.n} givens={match.givens} constraints={match.constraints} board={board} onPlace={() => {}} disabled highlights={hl} onHighlight={point} />
    if (mode === 'ZIP')    return <ZipBoard n={match.n} numbers={match.numbers} walls={match.walls} path={board} onPath={() => {}} disabled highlights={hl} onHighlight={point} />
    if (mode === 'CROSSCLIMB') return <CrossclimbBoard order={board} onOrder={() => {}} disabled highlights={hl} onHighlight={point} />
    return null
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><EyeIcon size={14} /> Watching <b>{watched.name}</b> · {status(watchId)}</p>
      {canPoint && <p className={styles.hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BulbIcon size={13} /> Tap a cell to point it out for {watched.name}.</p>}
      {ordered.length > 1 && (
        <div className={styles.tabs}>
          {ordered.map(p => (
            <button
              key={p.id}
              className={`${styles.tab} ${p.id === watchId ? styles.active : ''}`}
              onClick={() => setSel(p.id)}
            >
              {p.name} {status(p.id)}
            </button>
          ))}
        </div>
      )}
      {renderBoard()}
    </div>
  )
}
