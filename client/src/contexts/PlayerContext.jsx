import { createContext, useContext, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'ns_player'

function loadPlayer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function savePlayer(player) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(player))
}

function adjective() {
  const adj = ['Swift', 'Brave', 'Cunning', 'Witty', 'Bold', 'Sharp', 'Sly', 'Quick']
  const noun = ['Fox', 'Hawk', 'Bear', 'Wolf', 'Lynx', 'Owl', 'Raven', 'Viper']
  return adj[Math.floor(Math.random() * adj.length)] + noun[Math.floor(Math.random() * noun.length)]
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    const stored = loadPlayer()
    if (stored) return stored
    const fresh = { playerId: `guest_${uuidv4()}`, playerName: adjective(), totalGames: 0, avatar: null }
    savePlayer(fresh)
    return fresh
  })

  function setName(name) {
    const updated = { ...player, playerName: name.trim().slice(0, 20) || player.playerName }
    setPlayer(updated)
    savePlayer(updated)
  }

  // Chosen avatar id (null = use the deterministic playerId-seeded fallback).
  function setAvatar(avatar) {
    const updated = { ...player, avatar: avatar || null }
    setPlayer(updated)
    savePlayer(updated)
  }

  function incrementGames() {
    const updated = { ...player, totalGames: (player.totalGames || 0) + 1 }
    setPlayer(updated)
    savePlayer(updated)
  }

  return (
    <PlayerContext.Provider value={{ ...player, setName, setAvatar, incrementGames }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}
