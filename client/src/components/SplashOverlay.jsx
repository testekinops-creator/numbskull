import { useEffect, useState } from 'react'
import GameLogo from './GameLogo.jsx'
import GlitchWordmark from './GlitchWordmark.jsx'
import styles from './SplashOverlay.module.css'

const SPLASH_KEY = 'ns_splash_seen'
const DURATION   = 1800

export default function SplashOverlay({ onDone }) {
  const [phase, setPhase] = useState('enter')   // enter | hold | exit

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'),  DURATION - 400)
    const t2 = setTimeout(() => {
      localStorage.setItem(SPLASH_KEY, '1')
      onDone?.()
    }, DURATION)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`${styles.overlay} ${phase === 'exit' ? styles.exit : ''}`}>
      <div className={styles.inner}>
        <div className={styles.skull}>
          <GameLogo size={132} tilt={false} />
        </div>
        <div className={`${styles.wordmark} ${phase !== 'exit' ? styles.wordmarkEnter : ''}`}>
          <GlitchWordmark size="xl" />
        </div>
      </div>
    </div>
  )
}

export function shouldShowSplash() {
  return !localStorage.getItem(SPLASH_KEY)
}
