import { useState, useEffect, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { levelProgress } from '../utils/progression.js'
import { celebrateWin } from '../utils/celebrate.js'
import { lazyWithRetry } from '../utils/lazyWithRetry.js'

// Lazy so the ~23KB screens module loads only on the first level-up, not into
// the main bundle (this overlay is always mounted but renders nothing until then).
const LevelUpScreen = lazyWithRetry(() =>
  import('./numbskull-screens/NumbskullScreens.jsx').then(m => ({ default: m.LevelUpScreen })))

// Full-screen level-up celebration (the premium NumbskullScreens design), shown
// when the cached profile's level increases. Listens to the same 'ns-level-up'
// window event AuthContext.updateUser fires, so it stays in sync with the real
// level + XP. Replaces the old subtle toast. Dismiss with "Claim & continue" or Esc.

// Real, level-driven rank flavour (no separate rank system to track).
const RANKS = ['Rookie', 'Cipher', 'Decoder', 'Operative', 'Cryptanalyst', 'Mastermind', 'Numbskull Legend']
function rankForLevel(lvl = 1) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((Math.max(1, lvl) - 1) / 5))]
}

export default function LevelUpCelebration() {
  const { user } = useAuth()
  const [level, setLevel] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      const lvl = e.detail?.level
      if (!lvl) return
      setLevel(lvl)
      celebrateWin()
    }
    window.addEventListener('ns-level-up', handler)
    return () => window.removeEventListener('ns-level-up', handler)
  }, [])

  const close = useCallback(() => setLevel(null), [])
  useEffect(() => {
    if (!level) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [level, close])

  if (!level) return null
  const lp = levelProgress(user?.xp ?? 0)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Level up"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, overflowY: 'auto', background: '#1C1842' }}
    >
      <Suspense fallback={null}>
        <LevelUpScreen level={level} rank={rankForLevel(level)} xp={lp.into} xpMax={lp.span} onPrimary={close} />
      </Suspense>
    </div>,
    document.body,
  )
}
