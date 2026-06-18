import { useState } from 'react'
import QueensBoard from './QueensBoard.jsx'
import TangoBoard from './TangoBoard.jsx'
import ZipBoard from './ZipBoard.jsx'
import styles from './RaceWatch.module.css'

// Once you've finished (solved or gave up) a race, watch the other players' boards
// fill in live. The server sends DONE players everyone's boards (match.boards), so
// this just renders the selected opponent's board read-only + a tab to switch.
export default function RaceWatch({ match, players = [], playerId, mode }) {
  const opponents = players.filter(p => p.id !== playerId)
  const isDone = (id) => !!(match.solved?.[id] || match.gaveUp?.[id])
  const total = mode === 'QUEENS' ? match.n : match.n * match.n
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
  const status = (id) => match.solved?.[id] ? '✅' : match.gaveUp?.[id] ? '🏳' : `${match.placed?.[id] ?? 0}/${total}`

  const renderBoard = () => {
    if (mode === 'QUEENS') return <QueensBoard n={match.n} regions={match.regions} board={board} onPlace={() => {}} disabled />
    if (mode === 'TANGO')  return <TangoBoard n={match.n} givens={match.givens} constraints={match.constraints} board={board} onPlace={() => {}} disabled />
    if (mode === 'ZIP')    return <ZipBoard n={match.n} numbers={match.numbers} walls={match.walls} path={board} onPath={() => {}} disabled />
    return null
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.note}>👁 Watching <b>{watched.name}</b> · {status(watchId)}</p>
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
