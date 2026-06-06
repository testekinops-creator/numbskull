import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../services/api.js'
import { celebrateBadge } from '../utils/celebrate.js'
import styles from './BadgeToast.module.css'

// Global "badge unlocked!" celebration. Mounted once in App; listens for the
// 'ns-badge-earned' window event (fired by services/badges.js) and shows each
// newly-earned badge in turn.
export default function BadgeToast() {
  const [catalog, setCatalog] = useState({})
  const [current, setCurrent] = useState(null)
  const queue = useRef([])
  const busy = useRef(false)

  useEffect(() => {
    api.get('/badges')
      .then(d => {
        const map = {}
        ;(d.badges || []).forEach(b => { map[b.slug] = b })
        setCatalog(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function pump() {
      if (busy.current) return
      const next = queue.current.shift()
      if (!next) return
      busy.current = true
      setCurrent(next)
      setTimeout(() => { busy.current = false; setCurrent(null); pump() }, 3400)
    }
    const handler = (e) => { queue.current.push(...(e.detail?.slugs || [])); pump() }
    window.addEventListener('ns-badge-earned', handler)
    return () => window.removeEventListener('ns-badge-earned', handler)
  }, [])

  // Gold pop each time a new badge surfaces.
  useEffect(() => { if (current) celebrateBadge() }, [current])

  const b = current ? catalog[current] : null
  if (!b) return null

  return createPortal(
    <div className={`${styles.toast} anim-bounce-land`} role="status" aria-live="polite">
      <span className={styles.icon}>{b.icon}</span>
      <div className={styles.text}>
        <span className={styles.label}>Badge unlocked!</span>
        <span className={styles.name}>{b.name}</span>
      </div>
    </div>,
    document.body,
  )
}
