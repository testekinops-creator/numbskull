import { useState, useRef, useEffect } from 'react'
import { useSound } from '../../hooks/useSound.js'
import styles from './SpinWheel.module.css'

export const SPIN_MS = 3600

const CX = 100, CY = 100, R = 94, LABEL_R = 60

function pol(deg, r = R) {
  const a = (deg - 90) * Math.PI / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function slicePath(i, seg) {
  const [x1, y1] = pol(i * seg)
  const [x2, y2] = pol((i + 1) * seg)
  const large = seg > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
}

function displayLabel(v) {
  if (v === 'BANKRUPT') return 'BANK'
  if (v === 'LOSE_TURN') return 'LOSE'
  if (v === 'EXTRA_TURN') return '+200'
  if (v === 'DOUBLE') return '2×'
  if (v === 'JACKPOT') return 'JACK'
  if (v === 'STEAL') return 'STEAL'
  if (v === 'SHIELD') return 'SHLD'
  if (v === 'FREEZE') return 'FRZ'
  return String(v)
}

function fillFor(v, i) {
  if (v === 'BANKRUPT') return '#140f28'
  if (v === 'LOSE_TURN') return '#ff3e8a'
  if (v === 'EXTRA_TURN') return '#7c5cff'
  if (v === 'DOUBLE') return '#00e676'
  if (v === 'JACKPOT') return '#ffb300'
  if (v === 'STEAL') return '#ff7043'
  if (v === 'SHIELD') return '#42a5f5'
  if (v === 'FREEZE') return '#80deea'
  return i % 2 === 0 ? '#00c2d6' : '#0a8aa0'
}

// Server-authoritative wheel: it only animates to `targetIndex` (decided by the
// server). `nonce` bumps each spin so the same index re-triggers the animation.
export default function SpinWheel({ segments = [], targetIndex = 0, nonce = 0, spinning = false, onSettle }) {
  const [rotation, setRotation] = useState(0)
  const rotationRef = useRef(0)
  const settleRef = useRef(null)
  const { playSpin } = useSound()

  useEffect(() => {
    if (!nonce) return
    const n = segments.length || 1
    const seg = 360 / n
    const base = Math.ceil(rotationRef.current / 360) * 360 + 360 * 4
    const final = base + (360 - (targetIndex * seg + seg / 2))
    rotationRef.current = final
    setRotation(final)
    playSpin(SPIN_MS)   // decelerating ticks + landing thunk, in sync with the spin
    settleRef.current = setTimeout(() => onSettle?.(), SPIN_MS)
    return () => clearTimeout(settleRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  const n = segments.length || 1
  const seg = 360 / n

  return (
    <div className={styles.wrap}>
      <div className={styles.pointer} aria-hidden="true" />
      <svg viewBox="0 0 200 200" className={styles.svg} role="img" aria-label="Prize wheel">
        <circle cx={CX} cy={CY} r={R + 3} className={styles.rim} />
        <g
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.18, 0.7, 0.22, 1)` : 'none',
          }}
        >
          {segments.map((v, i) => {
            const [lx, ly] = pol(i * seg + seg / 2, LABEL_R)
            return (
              <g key={i}>
                <path d={slicePath(i, seg)} fill={fillFor(v, i)} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
                <text
                  x={lx} y={ly}
                  className={styles.label}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${i * seg + seg / 2} ${lx} ${ly})`}
                >
                  {displayLabel(v)}
                </text>
              </g>
            )
          })}
        </g>
        <circle cx={CX} cy={CY} r="14" className={styles.hub} />
      </svg>
    </div>
  )
}
