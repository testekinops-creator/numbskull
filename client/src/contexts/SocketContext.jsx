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

  // Always use the registered username if logged in, otherwise use guest name
  const displayName = isRegistered && user?.username ? user.username : playerName

  useEffect(() => {
    if (!playerId) return

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

    const socket = io(SOCKET_URL, {
      auth: { playerId, playerName: displayName },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('error:duplicate_tab', () => {
      alert('You opened Numbskull in another tab. This tab has been disconnected.')
    })

    socketRef.current = socket
    return () => { socket.disconnect(); socketRef.current = null }
  }, [playerId, displayName])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider')
  return ctx
}
