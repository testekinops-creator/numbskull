import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon } from '../icons/Icons.jsx'
import styles from './CrossclimbBoard.module.css'

// Presentational Crossclimb ladder. The board IS the player's current ORDER of
// the rungs; ▲/▼ move a rung up or down. A connector between two rungs glows
// green when that pair differs by exactly one letter — solve the whole ladder to
// win. Like Zip, multiplayer keeps an OPTIMISTIC local order so moves feel
// instant (we ignore the server's lagging echo of the same word-set, but adopt a
// genuinely new set on reconnect / rematch). Parent owns networking via onOrder.
//   order       : string[]   the player's current arrangement (== match.myBoard)
//   onOrder     : (next) => void
//   disabled    : boolean    (done / watching → no moves)
//   solved      : boolean
//   highlights  : number[]   positions a finished watcher is pointing at
//   onHighlight : (index) => void   point-mode (watch): tap a rung to point it out
function differByOne(a, b) {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { d++; if (d > 1) return false }
  return d === 1
}

export default function CrossclimbBoard({ order = [], onOrder, disabled = false, solved = false, highlights = [], onHighlight }) {
  const [localOrder, setLocalOrder] = useState(order)
  const highlightSet = useMemo(() => new Set(highlights), [highlights])
  const setKey = (a) => [...a].sort().join('|')
  const lastSetRef = useRef(setKey(order))

  // Adopt an externally-changed order only when it's a genuinely DIFFERENT word
  // set (new puzzle / reconnect). Within a puzzle, every order is a permutation
  // of the same set, so we keep our optimistic local order and ignore echoes.
  useEffect(() => {
    const key = setKey(order)
    if (key !== lastSetRef.current) {
      lastSetRef.current = key
      setLocalOrder(order)
    }
  }, [order])

  const effective = onHighlight ? order : localOrder   // watch mode shows the live server order

  function move(i, dir) {
    const j = i + dir
    if (disabled || j < 0 || j >= effective.length) return
    const next = [...effective]
    ;[next[i], next[j]] = [next[j], next[i]]
    setLocalOrder(next)
    onOrder?.(next)
  }

  if (!effective.length) return null

  return (
    <div className={`${styles.board} ${solved ? styles.solved : ''}`} role="list" aria-label="Crossclimb ladder">
      {effective.map((word, i) => {
        const linkOk = i < effective.length - 1 && differByOne(word, effective[i + 1])
        return (
          <div key={`${word}-${i}`} className={styles.rungWrap}>
            <div
              className={`${styles.rung} ${highlightSet.has(i) ? styles.highlight : ''} ${onHighlight ? styles.pointable : ''}`}
              role="listitem"
              onPointerUp={onHighlight ? (e) => { e.preventDefault(); onHighlight(i) } : undefined}
            >
              {!onHighlight && (
                <div className={styles.controls}>
                  <button type="button" className={styles.move} disabled={disabled || i === 0}
                    onPointerUp={(e) => { e.preventDefault(); move(i, -1) }} aria-label={`Move ${word} up`}>▲</button>
                  <button type="button" className={styles.move} disabled={disabled || i === effective.length - 1}
                    onPointerUp={(e) => { e.preventDefault(); move(i, 1) }} aria-label={`Move ${word} down`}>▼</button>
                </div>
              )}
              <span className={styles.word}>{word}</span>
            </div>
            {i < effective.length - 1 && (
              <div className={`${styles.link} ${linkOk ? styles.linkOk : ''}`} aria-hidden="true">
                {linkOk ? <CheckIcon size={14} /> : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
