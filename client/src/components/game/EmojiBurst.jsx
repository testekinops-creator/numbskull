import { useEffect, useState } from 'react'
import styles from './EmojiBurst.module.css'

/**
 * Full-screen overlay that spawns a floating emoji each time `trigger` changes.
 * Rapid presses → many floating emojis = a "flood".
 * `trigger` = { id, emoji, mine } from RoomContext.state.lastEmoji
 */
export default function EmojiBurst({ trigger }) {
  const [floaters, setFloaters] = useState([])

  useEffect(() => {
    if (!trigger?.id) return

    // Spawn 1 floater per trigger, with randomized motion
    const floater = {
      key:      trigger.id,
      emoji:    trigger.emoji,
      left:     8 + Math.random() * 84,          // vw %
      drift:    (Math.random() * 80 - 40).toFixed(0), // px horizontal drift
      duration: 2.2 + Math.random() * 1.2,       // s
      scale:    0.9 + Math.random() * 0.8,
      rotate:   (Math.random() * 50 - 25).toFixed(0),
    }
    setFloaters(prev => [...prev, floater])

    const t = setTimeout(() => {
      setFloaters(prev => prev.filter(f => f.key !== floater.key))
    }, floater.duration * 1000)

    return () => clearTimeout(t)
  }, [trigger?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (floaters.length === 0) return null

  return (
    <div className={styles.layer} aria-hidden="true">
      {floaters.map(f => (
        <span
          key={f.key}
          className={styles.floater}
          style={{
            left: `${f.left}vw`,
            '--drift': `${f.drift}px`,
            '--duration': `${f.duration}s`,
            '--scale': f.scale,
            '--rotate': `${f.rotate}deg`,
          }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  )
}
