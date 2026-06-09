import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { playMusicFor, stopMusic, modeForRoute, useMusicEnabled } from '../services/gameMusic.js'

// Headless controller: plays the right game's music while you're in a game
// (solo /play/* or a multiplayer /room/*) and stops it everywhere else.
export default function GameMusic() {
  const { pathname } = useLocation()
  const { state } = useRoom()
  const [enabled] = useMusicEnabled()
  const mode = modeForRoute(pathname, state?.room?.mode)

  useEffect(() => {
    if (mode && enabled) playMusicFor(mode)
    else stopMusic()
  }, [mode, enabled])

  useEffect(() => () => stopMusic(), [])
  return null
}
