import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { canExtend } from '../../utils/zip.js'
import styles from './ZipBoard.module.css'

// Zip board: drag (or tap) to draw one path 1→K through every cell, never crossing a
// wall. Renders the numbered cells + walls + the drawn line as an SVG overlay.
//
// `optimistic` (multiplayer): render a LOCAL copy of the path so the line follows the
// finger instantly, instead of waiting for the server to echo each cell back (which
// made it stutter by a network round-trip per cell). We still call onPath to send it;
// we ignore the server's lagging echoes (a strict prefix of what we've already drawn)
// but adopt any external change (reconnect / restore). In solo the board is controlled
// by the `path` prop (so the Clear/Undo buttons work) — already instant, no network.
export default function ZipBoard({ n, numbers = [], walls = [], path = [], onPath, disabled = false, solved = false, optimistic = false, highlights = [], onHighlight }) {
  const highlightSet = useMemo(() => new Set(highlights), [highlights])
  const draggingRef = useRef(false)
  const [localPath, setLocalPath] = useState(path)
  const effective = optimistic ? localPath : path
  const pathRef = useRef(effective)
  pathRef.current = effective                  // always read the latest path during a drag

  // Optimistic mode: sync from props on external changes, but ignore lagging echoes.
  useEffect(() => {
    if (!optimistic || draggingRef.current) return
    const lp = pathRef.current
    const stale = path.length < lp.length && path.every((c, i) => c === lp[i])  // echo of an earlier state
    if (!stale) setLocalPath(path)
  }, [path, optimistic])

  const oneCell = useMemo(() => numbers.indexOf(1), [numbers])
  const lastNum = useMemo(() => Math.max(0, ...numbers), [numbers])   // K — the path must END here
  const posInPath = useMemo(() => { const m = new Map(); effective.forEach((c, i) => m.set(c, i)); return m }, [effective])

  const commit = useCallback((next) => { if (optimistic) setLocalPath(next); onPath(next) }, [optimistic, onPath])

  // Single primitive: extend toward `cell`, or retract to it if it's already on the path.
  const applyTo = useCallback((cell) => {
    if (disabled || cell == null || cell < 0) return
    const cur = pathRef.current
    const idx = cur.indexOf(cell)
    if (idx !== -1) { if (idx < cur.length - 1) commit(cur.slice(0, idx + 1)); return }   // retract
    if (cur.length === 0) { if (cell === oneCell) commit([cell]); return }                // must start at 1
    const head = cur[cur.length - 1]
    if (numbers[head] === lastNum) return                                                 // path ENDS at the last number
    if (!canExtend(head, cell, n, walls)) return                                          // adjacent + no wall
    // Numbers must be entered in order — you can't reach 3 before 2. (Matches the
    // rules, so a fully-drawn grid is guaranteed to be the valid solution → it wins.)
    const num = numbers[cell]
    if (num > 0) {
      let visited = 0
      for (const c of cur) if (numbers[c] > 0) visited++
      if (num !== visited + 1) return
    }
    commit([...cur, cell])
  }, [disabled, oneCell, lastNum, n, walls, numbers, commit])

  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y)
    const idx = el?.getAttribute?.('data-idx')
    return idx == null ? -1 : Number(idx)
  }
  const onPointerDown = (e) => {
    const cell = cellFromPoint(e.clientX, e.clientY)
    if (onHighlight) { if (cell >= 0) onHighlight(cell); return }   // point-mode: tap toggles a highlight
    if (disabled) return
    draggingRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    applyTo(cell)
  }
  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const c = cellFromPoint(e.clientX, e.clientY)
    const head = pathRef.current[pathRef.current.length - 1]
    if (c >= 0 && c !== head) applyTo(c)
  }
  const endDrag = () => { draggingRef.current = false }

  if (!n || !numbers.length) return null

  // SVG geometry (viewBox 0..n in both axes; cell centres at col+0.5, row+0.5).
  const center = (cell) => [(cell % n) + 0.5, ((cell / n) | 0) + 0.5]
  const linePoints = effective.map(c => center(c).join(',')).join(' ')
  const wallSegs = walls.map(({ a, b }) => {
    const lo = Math.min(a, b), col = lo % n, row = (lo / n) | 0
    return b === lo + 1
      ? { x1: col + 1, y1: row, x2: col + 1, y2: row + 1 }   // vertical wall (right edge)
      : { x1: col, y1: row + 1, x2: col + 1, y2: row + 1 }   // horizontal wall (bottom edge)
  })
  const head = effective.length ? effective[effective.length - 1] : -1

  return (
    <div
      className={`${styles.board} ${solved ? styles.solved : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      role="grid"
      aria-label="Zip board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {numbers.map((num, i) => {
        const onPath = posInPath.has(i)
        return (
          <div
            key={i}
            data-idx={i}
            className={`${styles.cell} ${onPath ? styles.onPath : ''} ${i === head ? styles.head : ''} ${i === oneCell && effective.length === 0 ? styles.start : ''} ${highlightSet.has(i) ? styles.highlight : ''}`}
            aria-label={`Cell ${i + 1}${num ? `, number ${num}` : ''}`}
          >
            {num > 0 && <span className={styles.num}>{num}</span>}
          </div>
        )
      })}

      <svg className={styles.overlay} viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
        {effective.length > 1 && (
          <polyline points={linePoints} className={styles.path} />
        )}
        {wallSegs.map((w, k) => (
          <line key={k} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={styles.wall} />
        ))}
      </svg>
    </div>
  )
}
