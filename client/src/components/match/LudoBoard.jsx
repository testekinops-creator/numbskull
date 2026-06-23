import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './LudoBoard.module.css'
import { useSound } from '../../hooks/useSound.js'
import LudoToken from './LudoToken.jsx'

// 15×15 Ludo board. Logical positions come from the server (match.tokens); this
// maps them to grid cells and animates moves. Token positions:
//   -1 base · 0..50 main loop (rel to colour start) · 51..55 home column · 56 center.

// Main loop, clockwise. Index 0 = red start; 13/26/39 = green/yellow/blue starts.
const TRACK = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
]
const START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 }
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47])
const HOME = {
  red:    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green:  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
}
const BASE = {
  red:    [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green:  [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue:   [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
}
const CENTER = [7, 7]
const COLOR = { red: '#FF4D6D', green: '#22D466', yellow: '#FFC93C', blue: '#3AA0FF' }
const COLOR_HI = { red: '#FF96AB', green: '#7BF0A6', yellow: '#FFE08A', blue: '#8FCBFF' }
const COLOR_DK = { red: '#8E1E36', green: '#0F5E30', yellow: '#8A6411', blue: '#16466E' }
const BASE_AREA = { red: [1, 1], green: [1, 10], yellow: [10, 10], blue: [10, 1] }
// Travel direction out of each start cell (the ➜ glyph points right at 0°).
const START_ARROW = { red: 0, green: 90, yellow: 180, blue: 270 }

// Grid cell for a token position (or null for base — handled separately).
function cellOf(color, pos) {
  if (pos >= 0 && pos <= 50) return TRACK[(START_OFFSET[color] + pos) % 52]
  if (pos >= 51 && pos <= 55) return HOME[color][pos - 51]
  if (pos === 56) return CENTER
  return null
}
const pct = (i) => ((i + 0.5) / 15) * 100   // cell-centre as % of the board

// Tidy arrangement when N tokens share one square: they shrink and tile so each
// stays visible. dx/dy are fractions of a token's own size; s is its scale.
function clusterLayout(i, n) {
  if (n <= 1) return { dx: 0, dy: 0, s: 1 }
  if (n === 2) return { dx: (i === 0 ? -0.27 : 0.27), dy: 0, s: 0.74 }
  if (n === 3) {
    const p = [[0, -0.34], [-0.3, 0.22], [0.3, 0.22]][i]
    return { dx: p[0], dy: p[1], s: 0.62 }
  }
  // 4+ → 2×2 (a 5th+ token would tile onto the same four spots)
  const p = [[-0.28, -0.3], [0.28, -0.3], [-0.28, 0.26], [0.28, 0.26]][i % 4]
  return { dx: p[0], dy: p[1], s: 0.56 }
}

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
}

// Cube rotation (deg) that brings each face toward the viewer. Tumbling adds full
// spins on top so the die visibly rolls before landing on its value.
const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, -180] }
function faceTransform(v, spins = 0) {
  const [x, y] = FACE_ROT[v] || [0, 0]
  return `rotateX(${x + spins * 360}deg) rotateY(${y + spins * 360}deg)`
}
const TOAST_CLS = { six: 'toastSix', capture: 'toastCapture', bust: 'toastBust', pass: 'toastPass', home: 'toastHome' }

const STEP_MS = 165      // time per single-cell hop
const TURN_MS = 30000    // matches the server's LUDO_TURN_MS (for the countdown ring)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const cloneTokens = (t) => { const o = {}; for (const k in t) o[k] = (t[k] || []).slice(); return o }

// The cells a token visits going oldPos → newPos (so we can walk it box-by-box).
function pathPositions(oldPos, newPos) {
  if (oldPos === -1) return [0]                       // release: one hop onto the start cell
  const out = []
  for (let p = oldPos + 1; p <= newPos; p++) out.push(p)
  return out
}

// Turn a (prev → next) token diff into an animation job: which of the mover's
// tokens advanced, and which opponents it captured. Returns null if it's not a
// clean single move (rolls, passes, or a full resync → just snap).
function computeJob(prev, next, moverColor) {
  if (!moverColor || !next[moverColor]) return null
  const mp = prev[moverColor] || [], mn = next[moverColor] || []
  let idx = -1, changes = 0
  for (let i = 0; i < mn.length; i++) if (mn[i] !== (mp[i] ?? -1)) { idx = i; changes++ }
  if (changes !== 1 || idx === -1) return null
  const oldPos = mp[idx] ?? -1, newPos = mn[idx]
  if (newPos < oldPos && oldPos !== -1) return null    // not a forward move → snap
  const captured = []
  for (const c of Object.keys(next)) {
    if (c === moverColor) continue
    next[c].forEach((p, j) => { if (p === -1 && (prev[c]?.[j] ?? -1) >= 0) captured.push({ color: c, idx: j }) })
  }
  return { moverColor, idx, oldPos, newPos, captured }
}

export default function LudoBoard({ match, players = [], playerId, onRoll, onMove }) {
  const { tokens = {}, colors = {}, order = [], turnId, dice, movable = [], lastRoll, lastEvent, lastAuto, seq = 0, turnEndsAt } = match || {}
  const sound = useSound()
  const myColor = colors[playerId] || null
  const turnColor = colors[turnId] || null
  const myTurn = turnId === playerId
  const canRoll = myTurn && dice == null
  const canMove = myTurn && dice != null
  const turnIsBot = !!players.find(p => p.id === turnId)?.isBot

  const [rolling, setRolling] = useState(false)
  const [cube, setCube] = useState(() => faceTransform(lastRoll || 6, 0))
  const [toast, setToast] = useState(null)
  const [pressed, setPressed] = useState(false)
  const [disp, setDisp] = useState(() => cloneTokens(tokens))   // animated render positions
  const [hopKey, setHopKey] = useState(null)                    // token mid-hop (fast transition + lift)
  const [impact, setImpact] = useState(null)                    // [r,c] of a capture shockwave
  const [spawn, setSpawn] = useState(null)                      // { cell, color } when a token is released onto its start
  const [slamKey, setSlamKey] = useState(null)                  // striker doing the pounce-slam
  const [shatter, setShatter] = useState([])                    // [{ key, color, from, to }] captured tokens shattering
  const [shatterPhase, setShatterPhase] = useState('explode')   // 'explode' → 'travel' (shards stream to base)
  const [hidden, setHidden] = useState(() => new Set())         // token keys hidden while their shards travel
  const [reform, setReform] = useState(() => new Set())         // token keys popping back together at base
  const [hoverTok, setHoverTok] = useState(null)                // token whose move preview is emphasised
  const [now, setNow] = useState(() => Date.now())              // ticks the turn countdown
  const spins = useRef(0)
  const settleT = useRef(null)
  const toastT = useRef(null)
  const prevSeq = useRef(seq)
  const lastTruth = useRef(cloneTokens(tokens))                 // last fully-applied server state
  const queue = useRef([])
  const running = useRef(false)

  const nameOf = (id) => players.find(p => p.id === id)?.name || ''

  function flashToast(text, kind) {
    setToast({ text, kind })
    clearTimeout(toastT.current)
    toastT.current = setTimeout(() => setToast(null), 1600)
  }

  // Walk one token along its path, box-by-box, then resolve any capture.
  async function animateJob(job, next) {
    const { moverColor, idx, oldPos, newPos, captured } = job
    const key = `${moverColor}-${idx}`
    for (const p of pathPositions(oldPos, newPos)) {
      setHopKey(key)
      setDisp(d => { const n = cloneTokens(d); n[moverColor][idx] = p; return n })
      sound.playStep()
      if (p === 56) sound.playHome()
      await sleep(STEP_MS)
    }
    setHopKey(null)
    // Releasing a token from base onto its start cell → a premium spawn burst.
    if (oldPos === -1) {
      setSpawn({ cell: cellOf(moverColor, 0), color: moverColor })
      setTimeout(() => setSpawn(null), 650)
    }
    if (captured.length) {
      sound.playCapture()
      flashToast('Captured! Sent home', 'capture')
      const landCell = cellOf(moverColor, newPos)
      const capKeys = captured.map(c => `${c.color}-${c.idx}`)
      // 1) the striker pounces (jump-slam) + a shockwave, and the victims shatter in place
      setSlamKey(key)
      setImpact(landCell)
      setHidden(new Set(capKeys))
      setShatterPhase('explode')
      setShatter(captured.map(c => ({ key: `${c.color}-${c.idx}`, color: c.color, from: landCell, to: BASE[c.color][c.idx] })))
      await sleep(430)
      // 2) the shards stream back to base (token is already "sent home" underneath)
      setDisp(d => { const n = cloneTokens(d); captured.forEach(c => { n[c.color][c.idx] = -1 }); return n })
      setImpact(null); setSlamKey(null)
      setShatterPhase('travel')
      await sleep(470)
      // 3) the pieces reassemble into a whole token in its base slot
      setShatter([])
      setHidden(new Set())
      setReform(new Set(capKeys))
      await sleep(320)
      setReform(new Set())
    }
    setDisp(cloneTokens(next))                       // snap to the authoritative state
    if (newPos === 56) flashToast('A token reached home!', 'home')
  }

  async function runQueue() {
    if (running.current) return
    running.current = true
    while (queue.current.length) {
      const { job, next } = queue.current.shift()
      await animateJob(job, next)
    }
    running.current = false
  }

  // Drive everything off the monotonic seq — works for my turns AND bots'.
  useEffect(() => {
    if (seq === prevSeq.current) return
    prevSeq.current = seq
    const prev = lastTruth.current
    const next = cloneTokens(tokens)
    lastTruth.current = next

    if (lastEvent === 'roll' || lastEvent === 'pass' || lastEvent === 'bust') {
      sound.playDice(620)
      setRolling(true)
      spins.current += 2
      setCube(faceTransform(lastRoll || 1, spins.current))   // 3D tumble, land on value
      clearTimeout(settleT.current)
      settleT.current = setTimeout(() => {
        setRolling(false)
        if (lastAuto) flashToast("Time's up — auto-played", 'pass')
        else if (lastEvent === 'bust') flashToast('Three sixes — turn lost', 'bust')
        else if (lastEvent === 'pass') flashToast('No legal move — passed', 'pass')
        else if (lastRoll === 6) flashToast('Six! Roll again', 'six')
      }, 760)
    } else if (lastEvent === 'move' || lastEvent === 'capture') {
      const job = computeJob(prev, next, colors[match?.lastBy])
      if (job) { queue.current.push({ job, next }); runQueue() }
      else setDisp(next)                                     // resync → snap, no animation
    } else {
      setDisp(next)
    }
  }, [seq]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(settleT.current); clearTimeout(toastT.current) }, [])

  // Tick the countdown while a human is on the clock.
  useEffect(() => {
    if (!turnEndsAt || turnIsBot) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [turnEndsAt, turnIsBot])

  // Move preview: where each movable token would land + the outcome there.
  // Deduped per destination cell, so e.g. a 6 with several tokens in base shows
  // ONE marker on the start cell instead of a stack.
  const previews = useMemo(() => {
    if (!canMove || dice == null || !myColor) return []
    const byCell = new Map()
    for (const idx of movable) {
      const pos = (tokens[myColor] || [])[idx]
      const newPos = pos === -1 ? 0 : pos + dice
      const cell = cellOf(myColor, newPos)
      if (!cell) continue
      const abs = newPos >= 0 && newPos <= 50 ? (START_OFFSET[myColor] + newPos) % 52 : null
      let outcome = 'normal'
      if (newPos >= 51) outcome = 'home'
      else if (abs != null && SAFE.has(abs)) outcome = 'safe'
      else if (abs != null) {
        for (const c of Object.keys(tokens)) {
          if (c === myColor) continue
          if ((tokens[c] || []).some(p => p >= 0 && p <= 50 && (START_OFFSET[c] + p) % 52 === abs)) { outcome = 'capture'; break }
        }
      }
      const key = cell.join(',')
      const ex = byCell.get(key)
      if (ex) { ex.idxs.push(idx); if (outcome === 'capture') ex.outcome = 'capture' }
      else byCell.set(key, { cell, outcome, idxs: [idx] })
    }
    return [...byCell.values()]
  }, [canMove, dice, movable, tokens, myColor])

  const remainMs = turnEndsAt ? Math.max(0, turnEndsAt - now) : 0

  function handleRoll() {
    if (!canRoll || rolling) return
    setPressed(true); setTimeout(() => setPressed(false), 180)
    sound.unlock()
    onRoll?.()
  }

  // Tokens (from the animated `disp` positions), grouped per cell so a shared
  // square fans them out.
  const placed = useMemo(() => {
    const list = []
    for (const color of Object.keys(disp)) {
      (disp[color] || []).forEach((posVal, idx) => {
        const key = `${color}-${idx}`
        if (hidden.has(key)) return                 // shattering as shards — not on the board
        const cell = posVal === -1 ? BASE[color][idx] : cellOf(color, posVal)
        if (!cell) return
        list.push({ color, idx, posVal, cell, key })
      })
    }
    const groups = {}
    list.forEach(t => { const k = t.cell.join(','); (groups[k] ||= []).push(t) })
    list.forEach(t => {
      const k = t.cell.join(',')
      const g = groups[k]
      t.stackI = g.indexOf(t)
      t.stackN = g.length
    })
    return list
  }, [disp, hidden])

  // Static scaffold (cell roles), computed once.
  const scaffold = useMemo(() => {
    const track = new Map(), home = new Map()
    TRACK.forEach(([r, c], i) => track.set(`${r},${c}`, i))
    for (const col of Object.keys(HOME)) HOME[col].forEach(([r, c]) => home.set(`${r},${c}`, col))
    return { track, home }
  }, [])

  const cells = []
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const key = `${r},${c}`
      const ti = scaffold.track.get(key)
      const homeCol = scaffold.home.get(key)
      const isCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8
      if (isCenter) continue            // center drawn as one pinwheel element
      let cls = `${styles.cell} ${styles.blank}`, st = {}
      if (homeCol) { cls = `${styles.cell} ${styles.homeLane}`; st = { '--c': COLOR[homeCol], '--ch': COLOR_HI[homeCol] } }
      else if (ti != null) {
        const startCol = Object.keys(START_OFFSET).find(col => START_OFFSET[col] === ti)
        cls = `${styles.cell} ${styles.track}`
        if (startCol) { cls += ` ${styles.start}`; st = { '--c': COLOR[startCol], '--ch': COLOR_HI[startCol], '--arot': `${START_ARROW[startCol]}deg` } }
        else if (SAFE.has(ti)) cls += ` ${styles.safe}`
      }
      cells.push(<div key={key} className={cls} style={{ gridRow: r + 1, gridColumn: c + 1, ...st }} />)
    }
  }

  const bases = Object.keys(BASE_AREA).map(col => {
    const [r, c] = BASE_AREA[col]
    const active = turnColor === col
    return (
      <div key={col} className={`${styles.base} ${active ? styles.baseActive : ''}`}
        style={{ gridRow: `${r} / span 6`, gridColumn: `${c} / span 6`, '--c': COLOR[col], '--ch': COLOR_HI[col], '--cd': COLOR_DK[col] }} />
    )
  })

  // Four white slots in every base (all colours), so empty corners aren't bare.
  const pockets = Object.keys(BASE).flatMap(color =>
    BASE[color].map((cell, i) => (
      <span key={`pk-${color}-${i}`} className={styles.pocket}
        style={{ left: `${pct(cell[1])}%`, top: `${pct(cell[0])}%` }} />
    )))

  return (
    <div className={styles.wrap} style={{ '--turn': COLOR[turnColor] || '#7c74c0' }}>
      {/* Scoreboard — one chip per player, lit when it's their turn. */}
      <div className={styles.scoreRow}>
        {order.map(id => {
          const col = colors[id]
          const home = (disp[col] || []).filter(p => p === 56).length
          const isBotP = !!players.find(p => p.id === id)?.isBot
          const active = id === turnId
          const secs = Math.ceil(remainMs / 1000)
          return (
            <div key={id} className={`${styles.chip} ${active ? styles.chipTurn : ''}`} style={{ '--c': COLOR[col], '--ch': COLOR_HI[col] }}>
              <span className={styles.chipDot} />
              <span className={styles.chipName}>{nameOf(id)}{id === playerId ? ' (you)' : ''}</span>
              {active && !isBotP && turnEndsAt ? (
                <span className={styles.chipClock} data-s={secs}
                  style={{ '--frac': Math.max(0, Math.min(1, remainMs / TURN_MS)), '--ck': secs <= 5 ? '#FF4D6D' : COLOR[col] }} />
              ) : (
                <span className={styles.chipHome}>
                  {[0, 1, 2, 3].map(i => <i key={i} className={`${styles.chipPip} ${i < home ? styles.chipPipOn : ''}`} />)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.board} style={{ '--turn': COLOR[turnColor] || '#7c74c0' }}>
        <div className={styles.grid}>
          {bases}
          {cells}
          {/* Pinwheel home — four triangles meeting at the centre. */}
          <div className={styles.center} style={{ gridRow: '7 / span 3', gridColumn: '7 / span 3' }}>
            <span className={styles.triTop}    style={{ background: COLOR.green }} />
            <span className={styles.triRight}  style={{ background: COLOR.yellow }} />
            <span className={styles.triBottom} style={{ background: COLOR.blue }} />
            <span className={styles.triLeft}   style={{ background: COLOR.red }} />
            <span className={styles.centerGem} />
          </div>
        </div>

        {/* Base slots — a white box per token, separated by the colored base. */}
        <div className={styles.pocketLayer}>{pockets}</div>

        {/* Token layer — absolutely positioned so moves slide smoothly. */}
        <div className={styles.tokenLayer}>
          {spawn && (
            <span className={styles.spawnBurst}
              style={{ left: `${pct(spawn.cell[1])}%`, top: `${pct(spawn.cell[0])}%`, color: COLOR[spawn.color] }} />
          )}
          {/* Move preview — where each movable token would land + the outcome. */}
          {previews.map(p => (
            <span
              key={`ghost-${p.cell.join('-')}`}
              className={`${styles.ghost} ${styles['ghost_' + p.outcome]} ${p.idxs.includes(hoverTok) ? styles.ghostActive : ''}`}
              style={{ left: `${pct(p.cell[1])}%`, top: `${pct(p.cell[0])}%` }}
            />
          ))}
          {placed.map(t => {
            if (hidden.has(t.key)) return null            // shattering / travelling as shards
            const isMine = t.color === myColor
            const liftable = isMine && canMove && movable.includes(t.idx)
            const finished = t.posVal === 56
            const hopping = hopKey === t.key
            const isSlam = slamKey === t.key
            const isReform = reform.has(t.key)
            // share a square → shrink + tile so every token stays readable
            const { dx, dy, s } = clusterLayout(t.stackI, t.stackN)
            return (
              <button
                key={t.key}
                type="button"
                className={`${styles.token} ${liftable ? styles.movable : ''} ${finished ? styles.tokenHome : ''} ${hopping ? styles.hopping : ''} ${isSlam ? styles.slam : ''} ${isReform ? styles.reform : ''}`}
                disabled={!liftable}
                onClick={() => { if (liftable) { sound.unlock(); onMove?.(t.idx) } }}
                onPointerEnter={() => liftable && setHoverTok(t.idx)}
                onPointerLeave={() => liftable && setHoverTok(h => (h === t.idx ? null : h))}
                onFocus={() => liftable && setHoverTok(t.idx)}
                onBlur={() => liftable && setHoverTok(h => (h === t.idx ? null : h))}
                style={{
                  left: `${pct(t.cell[1])}%`,
                  top: `${pct(t.cell[0])}%`,
                  transform: `translate(calc(-50% + ${dx * 100}%), calc(-80% + ${dy * 100}%)) scale(${s})`,
                  zIndex: isSlam ? 96 : hopping ? 92 : liftable ? 90 : 20 + Math.round(t.cell[0] * 2) + Math.round(dy * 12) + t.stackI,
                  '--c': COLOR[t.color], '--ch': COLOR_HI[t.color], '--cd': COLOR_DK[t.color],
                }}
                aria-label={`${t.color} token ${t.idx + 1}`}
              >
                <LudoToken color={t.color} />
              </button>
            )
          })}
          {/* capture shockwave */}
          {impact && (
            <span className={styles.impact} style={{ left: `${pct(impact[1])}%`, top: `${pct(impact[0])}%` }} />
          )}
          {/* captured token shatters here, then its shards stream to base */}
          {shatter.map(sh => {
            const at = shatterPhase === 'travel' ? sh.to : sh.from
            return (
              <span key={`sh-${sh.key}`}
                className={`${styles.shatter} ${shatterPhase === 'travel' ? styles.shatterTravel : ''}`}
                style={{ left: `${pct(at[1])}%`, top: `${pct(at[0])}%`, color: COLOR[sh.color] }}>
                {Array.from({ length: 8 }).map((_, k) => (
                  <i key={k} className={styles.shard} style={{ '--a': `${k * 45}deg` }} />
                ))}
              </span>
            )
          })}
        </div>

        {toast && (
          <div className={`${styles.toast} ${styles[TOAST_CLS[toast.kind]] || ''}`}>{toast.text}</div>
        )}
      </div>

      {/* Control bar — turn message on the left, die on the right. */}
      <div className={styles.hud}>
        <span className={styles.turnText} style={{ '--turn': COLOR[turnColor] || '#7c74c0' }}>
          <span className={styles.turnDot} />
          {myTurn ? (canMove ? 'Tap a glowing token' : 'Your turn — roll!') : `${nameOf(turnId) || turnColor}'s turn`}
        </span>
        <div className={styles.dieWrap}>
          {canRoll && !rolling && <span className={styles.rollHint}>Tap the die</span>}
          <button
            type="button"
            className={`${styles.dieBtn} ${pressed ? styles.diePressed : ''} ${canRoll && !rolling ? styles.dieReady : ''}`}
            onClick={handleRoll}
            disabled={!canRoll || rolling}
            style={{ '--turn': COLOR[turnColor] || '#7c74c0' }}
            aria-label="Roll the die"
          >
            <span className={styles.scene}>
              <span className={`${styles.cube} ${rolling ? styles.cubeRolling : ''}`} style={{ transform: cube }}>
                {[1, 2, 3, 4, 5, 6].map(v => (
                  <span key={v} className={`${styles.face} ${styles['face' + v]}`}>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className={styles.diePip} style={{ opacity: (PIPS[v] || []).includes(i) ? 1 : 0 }} />
                    ))}
                  </span>
                ))}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
