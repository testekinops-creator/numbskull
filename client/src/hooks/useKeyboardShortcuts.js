import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const SHORTCUTS = [
  { key: 'g h',   description: 'Go Home',           path: '/' },
  { key: 'g p',   description: 'Go to Profile',      path: '/profile' },
  { key: 'g l',   description: 'Go to Leaderboard',  path: '/leaderboard' },
  { key: 'g d',   description: 'Go to Daily',        path: '/daily' },
  { key: 'g m',   description: 'Go to Multiplayer',  path: '/lobby' },
  { key: 'g b',   description: 'Go to Badges',       path: '/badges' },
  { key: 'g t',   description: 'Go to Theater',      path: '/theater' },
  { key: '?',     description: 'Show shortcuts',      path: null },
]

export { SHORTCUTS }

let pending = null
let pendingTimer = null

export function useKeyboardShortcuts(onShowHelp) {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === '?') {
        onShowHelp?.()
        return
      }

      if (pending) {
        const chord = `${pending} ${key}`
        const match = SHORTCUTS.find(s => s.key === chord && s.path)
        if (match) navigate(match.path)
        clearTimeout(pendingTimer)
        pending = null
        return
      }

      if (['g'].includes(key)) {
        pending = key
        pendingTimer = setTimeout(() => { pending = null }, 1000)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, onShowHelp])
}
