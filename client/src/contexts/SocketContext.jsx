import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { usePlayer } from './PlayerContext.jsx'
import { useAuth } from './AuthContext.jsx'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { playerId, playerName } = usePlayer()
  const { user, isRegistered } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const everConnectedRef = useRef(false)

  // Always use the registered username if logged in, otherwise use guest name
  const displayName = isRegistered && user?.username ? user.username : playerName

  useEffect(() => {
    if (!playerId) return

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

    const socket = io(SOCKET_URL, {
      auth: {
        playerId,
        playerName: displayName,
        userId: isRegistered && user?.id ? user.id : null,  // DB id for friend requests
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Never permanently give up — a phone can be locked for minutes and across
      // many lock/unlock cycles; we want it to keep trying to come back.
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    })

    const duplicateTab = { current: false }

    socket.on('connect', () => { setConnected(true); setReconnecting(false); everConnectedRef.current = true })
    socket.on('disconnect', () => { setConnected(false); if (everConnectedRef.current) setReconnecting(true) })
    socket.io.on('reconnect_attempt', () => { if (everConnectedRef.current) setReconnecting(true) })
    socket.io.on('reconnect', () => setReconnecting(false))
    socket.on('error:duplicate_tab', () => {
      duplicateTab.current = true
      alert('You opened Numbskull in another tab. This tab has been disconnected.')
    })

    // Mobile resilience: socket.io throttles its retry timers while the tab is
    // hidden, so after unlocking the phone (or the network returning) we nudge it
    // to reconnect right away instead of waiting out a throttled backoff.
    const nudge = () => {
      if (duplicateTab.current) return
      if (document.visibilityState === 'visible' && !socket.connected) socket.connect()
    }
    document.addEventListener('visibilitychange', nudge)
    window.addEventListener('online', nudge)
    window.addEventListener('focus', nudge)

    socketRef.current = socket
    return () => {
      document.removeEventListener('visibilitychange', nudge)
      window.removeEventListener('online', nudge)
      window.removeEventListener('focus', nudge)
      socket.disconnect()
      socketRef.current = null
    }
  }, [playerId, displayName])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, reconnecting }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider')
  return ctx
}
