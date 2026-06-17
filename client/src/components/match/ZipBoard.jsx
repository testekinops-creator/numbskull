import { useRef, useCallback, useMemo } from 'react'
import { canExtend } from '../../utils/zip.js'
import styles from './ZipBoard.module.css'

// Zip board: drag (or tap) to draw one path 1→K through every cell, never crossing a
// wall. The PARENT owns the path + networking via onPath(nextPath). We render the
// numbered cells + walls + the drawn line as an SVG overlay, and translate
// pointer/tap input into extend / retract operations on the path.
export default function ZipBoard({ n, numbers = [], walls = [], path = [], onPath, disabled = false, solved = false }) {
  const draggingRef = useRef(false)
  const pathRef = useRef(path)
  pathRef.current = path                       // always read the latest path during a drag

  const oneCell = useMemo(() => numbers.indexOf(1), [numbers])
  const lastNum = useMemo(() => Math.max(0, ...numbers), [numbers])   // K — the path must END here
  const posInPath = useMemo(() => { const m = new Map(); path.forEach((c, i) => m.set(c, i)); return m }, [path])

  // Single primitive: extend toward `cell`, or retract to it if it's already on the path.
  const applyTo = useCallback((cell) => {
    if (disabled || cell == null || cell < 0) return
    const cur = pathRef.current
    const idx = cur.indexOf(cell)
    if (idx !== -1) { if (idx < cur.length - 1) onPath(cur.slice(0, idx + 1)); return }   // retract
    if (cur.length === 0) { if (cell === oneCell) onPath([cell]); return }                // must start at 1
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
    onPath([...cur, cell])
  }, [disabled, oneCell, lastNum, n, walls, numbers, onPath])

  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y)
    const idx = el?.getAttribute?.('data-idx')
    return idx == null ? -1 : Number(idx)
  }
  const onPointerDown = (e) => {
    if (disabled) return
    draggingRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    applyTo(cellFromPoint(e.clientX, e.clientY))
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
  const linePoints = path.map(c => center(c).join(',')).join(' ')
  const wallSegs = walls.map(({ a, b }) => {
    const lo = Math.min(a, b), col = lo % n, row = (lo / n) | 0
    return b === lo + 1
      ? { x1: col + 1, y1: row, x2: col + 1, y2: row + 1 }   // vertical wall (right edge)
      : { x1: col, y1: row + 1, x2: col + 1, y2: row + 1 }   // horizontal wall (bottom edge)
  })
  const head = path.length ? path[path.length - 1] : -1

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
            className={`${styles.cell} ${onPath ? styles.onPath : ''} ${i === head ? styles.head : ''} ${i === oneCell && path.length === 0 ? styles.start : ''}`}
            aria-label={`Cell ${i + 1}${num ? `, number ${num}` : ''}`}
          >
            {num > 0 && <span className={styles.num}>{num}</span>}
          </div>
        )
      })}

      <svg className={styles.overlay} viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
        {path.length > 1 && (
          <polyline points={linePoints} className={styles.path} />
        )}
        {wallSegs.map((w, k) => (
          <line key={k} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={styles.wall} />
        ))}
      </svg>
    </div>
  )
}
