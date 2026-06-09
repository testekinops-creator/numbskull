import { useRef, useState } from 'react'
import styles from './SosBoard.module.css'

// Cell centre as a percentage of the (square) board — for the SVG line overlay.
const centerOf = (i, size) => {
  const r = Math.floor(i / size), c = i % size
  return { x: ((c + 0.5) / size) * 100, y: ((r + 0.5) / size) * 100 }
}
const sortTri = (t) => [...t].sort((a, b) => a - b)

// Presentational SOS board: an S|O toggle, an N×N grid, and an SVG overlay that
// draws claimed S–O–S lines. When you have lines to claim (`pending`), the board
// enters "claim mode": placement is disabled and you DRAW across an S–O–S (drag
// end-to-end, or tap a single highlighted cell that belongs to just one line) to
// claim it.
export default function SosBoard({
  size = 8,
  board = [],
  lines = [],            // [{ cells:[i,i,i], by }] — claimed, drawn as coloured lines
  pending = [],          // [[i,i,i]] — lines YOU must draw now (empty = place mode)
  mineId = 'player',     // lines where `by === mineId` are tinted as "yours"
  activeLetter = 'S',
  onLetterChange,
  onPlace,
  onClaim,
  disabled = false,
  lastCell = null,
}) {
  const wrapRef = useRef(null)
  const [drag, setDrag] = useState(null)      // { startCell, x, y } during a claim draw
  const claimMode = pending.length > 0

  const cellFromPoint = (clientX, clientY) => {
    const el = wrapRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left, y = clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
    const c = Math.min(size - 1, Math.max(0, Math.floor(x / (rect.width / size))))
    const r = Math.min(size - 1, Math.max(0, Math.floor(y / (rect.height / size))))
    return r * size + c
  }
  const localXY = (clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect()
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 }
  }

  const onDown = (e) => {
    if (!claimMode) return
    const cell = cellFromPoint(e.clientX, e.clientY)
    if (cell == null) return
    setDrag({ startCell: cell, ...localXY(e.clientX, e.clientY) })
    wrapRef.current.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    if (!drag) return
    setDrag(d => ({ ...d, ...localXY(e.clientX, e.clientY) }))
  }
  const onUp = (e) => {
    if (!drag) return
    const end = cellFromPoint(e.clientX, e.clientY)
    if (end != null) {
      let tri = pending.find(t => { const s = sortTri(t); return (s[0] === drag.startCell && s[2] === end) || (s[0] === end && s[2] === drag.startCell) })
      if (!tri && end === drag.startCell) {            // tap fallback (unambiguous cell)
        const hits = pending.filter(t => t.includes(end))
        if (hits.length === 1) tri = hits[0]
      }
      if (tri) onClaim?.(sortTri(tri))
    }
    setDrag(null)
  }

  const pendingCells = new Set(pending.flat())

  return (
    <div className={styles.outer}>
      <div className={styles.toggle} role="group" aria-label="Choose the letter to place">
        {['S', 'O'].map(L => (
          <button
            key={L}
            type="button"
            className={`${styles.toggleBtn} ${activeLetter === L ? styles.toggleActive : ''} ${L === 'S' ? styles.tS : styles.tO}`}
            onClick={() => onLetterChange?.(L)}
            aria-pressed={activeLetter === L}
          >
            {L}
          </button>
        ))}
        <span className={`${styles.hint} ${claimMode ? styles.hintDraw : ''}`}>
          {claimMode ? '✏️ Draw your S‑O‑S!' : `Placing ${activeLetter}`}
        </span>
      </div>

      <div
        ref={wrapRef}
        className={`${styles.board} ${claimMode ? styles.claiming : ''}`}
        style={{ '--n': size }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
      >
        {board.map((v, i) => (
          <button
            key={i}
            type="button"
            className={[
              styles.cell,
              v === 'S' ? styles.cS : '',
              v === 'O' ? styles.cO : '',
              i === lastCell ? styles.last : '',
              pendingCells.has(i) ? styles.pendingCell : '',
            ].join(' ')}
            onClick={() => { if (!claimMode && !disabled && v === null) onPlace?.(i) }}
            disabled={claimMode || disabled || v !== null}
            aria-label={`Cell ${i + 1}${v ? `, ${v}` : ', empty'}`}
          >
            {v && <span className={styles.glyph}>{v}</span>}
          </button>
        ))}

        <svg className={styles.overlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((ln, idx) => {
            const s = sortTri(ln.cells)
            const a = centerOf(s[0], size), b = centerOf(s[2], size)
            return (
              <line
                key={idx}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`${styles.sosLine} ${ln.by === mineId ? styles.lineMine : styles.lineTheirs}`}
              />
            )
          })}
          {drag && (() => {
            const a = centerOf(drag.startCell, size)
            return <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} className={styles.dragLine} />
          })()}
        </svg>
      </div>
    </div>
  )
}
