import { useRef, useState, useEffect } from 'react'
import styles from './SosBoard.module.css'
import { celebrateSos } from '../../utils/celebrate.js'
import { useHaptic } from '../../hooks/useHaptic.js'
import { EditIcon } from '../icons/Icons.jsx'

const COMBO_TEXT = (n) => (n === 2 ? '🔥 DOUBLE SOS!' : n === 3 ? '💥 TRIPLE SOS!' : `⚡ ${n}× MEGA SOS!`)
const CLAIM_HINT_KEY = 'ns_sos_claim_hint'   // first-time coach-mark seen flag

// Cell centre as a percentage of the (square) board — for the SVG line overlay.
const centerOf = (i, size) => {
  const r = Math.floor(i / size), c = i % size
  return { x: ((c + 0.5) / size) * 100, y: ((r + 0.5) / size) * 100 }
}
const sortTri = (t) => [...t].sort((a, b) => a - b)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Presentational SOS board. Tap an empty cell → a small S/O popover appears over
// it; pick a letter and it drops into that cell. When you've formed S–O–S lines
// (`pending`) the board enters "claim mode": placement is locked and you DRAW
// across an S–O–S (drag end-to-end, or tap a cell that belongs to just one line)
// to claim it.
export default function SosBoard({
  size = 8,
  board = [],
  lines = [],            // [{ cells:[i,i,i], by }] — claimed, drawn as coloured lines
  pending = [],          // [[i,i,i]] — lines YOU must draw now (empty = place mode)
  mineId = 'player',     // lines where `by === mineId` are tinted as "yours"
  onPlace,               // (cell, letter)
  onClaim,               // (cells)
  disabled = false,
  lastCell = null,
  glow = false,          // pulsing "your turn" ring, hugging the board frame
}) {
  const wrapRef = useRef(null)
  const [drag, setDrag] = useState(null)        // { startCell, x, y } during a claim draw
  const [placing, setPlacing] = useState(null)  // cell index with an open S/O popover
  const [combo, setCombo] = useState(null)      // { n, key } — DOUBLE/TRIPLE flash
  const [snap, setSnap] = useState(null)        // { key, x, y } — claim "snap" flash at the line midpoint
  const [coach, setCoach] = useState(false)     // first-time "drag to claim" hint
  const comboRef = useRef(0)                    // # lines the current pending move formed
  const { buzz } = useHaptic()
  const claimMode = pending.length > 0

  // Any state change that should dismiss the chooser.
  useEffect(() => { if (claimMode || disabled) setPlacing(null) }, [claimMode, disabled])

  // First-time coach-mark: the draw-to-claim mechanic isn't obvious, so the very
  // first time you form an S–O–S, show a one-time hint (then never again).
  useEffect(() => {
    if (claimMode && localStorage.getItem(CLAIM_HINT_KEY) !== '1') {
      setCoach(true)
      localStorage.setItem(CLAIM_HINT_KEY, '1')
    } else if (!claimMode) {
      setCoach(false)
    }
  }, [claimMode])

  // Combo: remember how many lines this move formed; when they're all drawn,
  // flash DOUBLE/TRIPLE.
  useEffect(() => {
    if (pending.length > comboRef.current) comboRef.current = pending.length
    if (pending.length === 0) {
      if (comboRef.current >= 2) {
        setCombo({ n: comboRef.current, key: Date.now() })
        buzz('win')
        setTimeout(() => setCombo(null), 1500)
      }
      comboRef.current = 0
    }
  }, [pending.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Claim draw gesture (only active in claim mode) ──────────────────────────
  const onDown = (e) => {
    if (!claimMode) return
    const cell = cellFromPoint(e.clientX, e.clientY)
    if (cell == null) return
    setDrag({ startCell: cell, ...localXY(e.clientX, e.clientY) })
    wrapRef.current.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => { if (drag) setDrag(d => ({ ...d, ...localXY(e.clientX, e.clientY) })) }

  // Confetti pop + a brief "snap" flash at the claimed line's midpoint (bigger
  // when it's a combo batch).
  const fireJuice = (tri) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const a = centerOf(tri[0], size), b = centerOf(tri[2], size)
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    setSnap({ key: Date.now(), x: mx, y: my })
    setTimeout(() => setSnap(null), 450)
    buzz('correct')
    celebrateSos({
      x: (rect.left + (mx / 100) * rect.width) / window.innerWidth,
      y: (rect.top + (my / 100) * rect.height) / window.innerHeight,
    }, comboRef.current)
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
      if (tri) { const sorted = sortTri(tri); fireJuice(sorted); onClaim?.(sorted) }
    }
    setDrag(null)
  }

  const choose = (letter) => { const cell = placing; setPlacing(null); if (cell != null) { buzz('tap'); onPlace?.(cell, letter) } }

  // Popover position: hug the chosen cell, above it (or below for the top row),
  // clamped so it never spills off the board edges.
  const popStyle = (() => {
    if (placing == null) return {}
    const r = Math.floor(placing / size), c = placing % size
    const above = r > 0
    return {
      left: `${clamp(((c + 0.5) / size) * 100, 16, 84)}%`,
      top: `${(above ? r / size : (r + 1) / size) * 100}%`,
      transform: above ? 'translate(-50%, calc(-100% - 6px))' : 'translate(-50%, 6px)',
    }
  })()

  const pendingCells = new Set(pending.flat())

  return (
    // The whole board rumbles for a beat when a DOUBLE/TRIPLE combo lands.
    <div className={`${styles.outer} ${combo ? 'anim-screen-shake' : ''}`}>
      <div
        ref={wrapRef}
        className={`${styles.board} ${claimMode ? styles.claiming : ''} ${glow ? styles.glow : ''}`}
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
              i === placing ? styles.choosing : '',
              pendingCells.has(i) ? styles.pendingCell : '',
            ].join(' ')}
            onClick={() => { if (!claimMode && !disabled && v === null) setPlacing(p => (p === i ? null : i)) }}
            disabled={claimMode || disabled || v !== null}
            aria-label={`Cell ${i + 1}${v ? `, ${v}` : ', empty'}`}
          >
            {v && <span className={styles.glyph}>{v}</span>}
          </button>
        ))}

        {/* Tap-to-place chooser */}
        {placing != null && (
          <>
            <div className={styles.popBackdrop} onClick={() => setPlacing(null)} />
            <div className={styles.pop} style={popStyle} role="dialog" aria-label="Place S or O">
              <button type="button" className={`${styles.popBtn} ${styles.popS}`} onClick={() => choose('S')}>S</button>
              <button type="button" className={`${styles.popBtn} ${styles.popO}`} onClick={() => choose('O')}>O</button>
            </div>
          </>
        )}

        <svg className={styles.overlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((ln, idx) => {
            const s = sortTri(ln.cells)
            const a = centerOf(s[0], size), b = centerOf(s[2], size)
            return (
              <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`${styles.sosLine} ${ln.by === mineId ? styles.lineMine : styles.lineTheirs}`} />
            )
          })}
          {drag && (() => {
            const a = centerOf(drag.startCell, size)
            return <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} className={styles.dragLine} />
          })()}
        </svg>

        {/* Claim "snap" — a quick flash ring where the drawn line landed */}
        {snap && (
          <div
            key={snap.key}
            className={styles.snapFlash}
            style={{ left: `${snap.x}%`, top: `${snap.y}%` }}
            aria-hidden="true"
          />
        )}

        {/* First-time coach-mark for the draw-to-claim mechanic */}
        {coach && <div className={styles.coach} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><EditIcon size={14} /> Drag across your S‑O‑S to claim it!</div>}

        {/* Combo flash */}
        {combo && <div key={combo.key} className={styles.comboFlash}>{COMBO_TEXT(combo.n)}</div>}
      </div>

      <p className={`${styles.hint} ${claimMode ? styles.hintDraw : ''}`}>
        {claimMode ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><EditIcon size={14} /> Draw the line through your S‑O‑S to score!</span> : 'Tap a square, then pick S or O'}
      </p>
    </div>
  )
}
