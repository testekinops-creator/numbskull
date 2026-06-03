import { useEffect, useRef, useState } from 'react'
import styles from './PressureMeter.module.css'

const THRESHOLDS = [
  { seconds: 15, urgency: 'mild' },
  { seconds: 30, urgency: 'high' },
  { seconds: 60, urgency: 'critical' },
]

export default function PressureMeter({ active, limitSeconds = 90 }) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current)
      setElapsed(0)
      startRef.current = null
      return
    }
    startRef.current = performance.now()
    function tick(now) {
      const secs = (now - startRef.current) / 1000
      setElapsed(secs)
      if (secs < limitSeconds) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, limitSeconds])

  const progress = Math.min(elapsed / limitSeconds, 1)
  const urgency = THRESHOLDS.filter(t => elapsed >= t.seconds).pop()?.urgency || 'normal'

  return (
    <div
      className={`${styles.meter} ${styles[urgency]}`}
      role="progressbar"
      aria-valuenow={Math.round(elapsed)}
      aria-valuemax={limitSeconds}
      aria-label="Thinking time"
    >
      <div
        className={styles.fill}
        style={{ '--progress-width': `${(1 - progress) * 100}%` }}
      />
    </div>
  )
}
