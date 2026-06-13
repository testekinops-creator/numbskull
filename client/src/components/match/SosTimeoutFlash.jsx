import { useState, useEffect, useRef } from 'react'
import styles from './SosTimeoutFlash.module.css'

// Premium centre-screen flash shown for ~2s whenever an SOS turn times out and the
// opponent is awarded the miss bonus. Adapts the copy to whether YOU missed or
// benefited. Driven by the transient `event` ({ by, bonusTo, amount, ts }).
export default function SosTimeoutFlash({ event, playerId, opponentName }) {
  const [show, setShow] = useState(false)
  const lastTs = useRef(0)

  useEffect(() => {
    if (!event || !event.ts || event.ts === lastTs.current || !event.amount) return
    lastTs.current = event.ts
    setShow(true)
    const t = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(t)
  }, [event])

  if (!show || !event) return null
  const iBenefited = event.bonusTo === playerId   // opponent missed → I got the bonus

  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-hidden={!show}>
      <div className={`${styles.card} ${iBenefited ? styles.good : styles.bad}`}>
        <span className={styles.icon} aria-hidden="true">⏱️</span>
        <span className={styles.title}>Time’s Up!</span>
        <span className={styles.sub}>
          {iBenefited
            ? `${opponentName || 'Opponent'} missed — +${event.amount} to you`
            : `You missed — +${event.amount} to ${opponentName || 'your opponent'}`}
        </span>
      </div>
    </div>
  )
}
