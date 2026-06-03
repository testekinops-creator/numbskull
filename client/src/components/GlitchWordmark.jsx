import { useEffect, useState, useRef, useCallback } from 'react'
import styles from './GlitchWordmark.module.css'

const CHARS = '!@#$%^&*?[]{}0123456789'
const DURATION_MS = 1200
const FRAMES      = 20

function runGlitch(target, setter, delay = 0) {
  const frameMs = DURATION_MS / FRAMES
  return new Promise(resolve => {
    setTimeout(() => {
      let frame = 0
      const timer = setInterval(() => {
        frame++
        if (frame >= FRAMES) {
          setter(target)
          clearInterval(timer)
          resolve()
          return
        }
        const progress    = frame / FRAMES
        const resolvedLen = Math.floor(progress * target.length)
        let text = target.slice(0, resolvedLen)
        for (let i = resolvedLen; i < target.length; i++) {
          text += CHARS[Math.floor(Math.random() * CHARS.length)]
        }
        setter(text)
      }, frameMs)
    }, delay)
  })
}

export default function GlitchWordmark({ size = 'lg' }) {
  const [numb,  setNumb]  = useState('Numb')
  const [skull, setSkull] = useState('skull')
  const runningRef = useRef(false)

  const playGlitch = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setNumb('????')
    setSkull('?????')
    runGlitch('Numb',  setNumb,  0)
    runGlitch('skull', setSkull, 140).then(() => {
      runningRef.current = false
    })
  }, [])

  // Auto-play once on mount
  useEffect(() => {
    playGlitch()
  }, [playGlitch])

  return (
    <h1
      className={`${styles.wordmark} ${styles[size]}`}
      onMouseEnter={playGlitch}
      aria-label="Numbskull"
    >
      <span className={styles.numb}>{numb}</span>
      <span className={styles.skull}>{skull}</span>
    </h1>
  )
}
