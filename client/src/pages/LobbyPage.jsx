import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import styles from './LobbyPage.module.css'

export default function LobbyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, createRoom, joinRoom, quickMatch, cancelQuickMatch, clearRoom } = useRoom()
  const { playerName, setName } = usePlayer()
  const { user, isRegistered } = useAuth()

  // Always show the authenticated username if logged in
  const displayName = isRegistered && user?.username ? user.username : playerName

  // Clear any stale room left over from a previous game on entering the lobby,
  // so the auto-navigate below can't bounce us back into a dead room.
  useEffect(() => { clearRoom() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Only auto-navigate when WE started matchmaking and then got paired.
  const startedMatchmakingRef = useRef(false)
  useEffect(() => {
    if (state.matchmaking) startedMatchmakingRef.current = true
    if (startedMatchmakingRef.current && !state.matchmaking &&
        state.room?.id && state.room.phase === 'SETUP') {
      startedMatchmakingRef.current = false
      navigate(`/room/${state.room.id}`)
    }
  }, [state.matchmaking, state.room?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mode can be preselected from the home games list (navigate state)
  const [mode, setMode] = useState(location.state?.mode === 'BC' ? 'BC' : 'GTN')
  const [joinCode, setJoinCode] = useState('')
  const [nameEdit, setNameEdit] = useState(displayName)
  const [tab, setTab] = useState('quick') // quick | create | join
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleQuickMatch() {
    setBusy(true); setError('')
    const res = await quickMatch(mode)
    setBusy(false)
    if (!res?.ok) { setError(res?.error || 'Failed'); return }
    if (res.matched) navigate(`/room/${res.room.id}`)
    // else waiting — UI shows matchmaking spinner
  }

  async function handleCreate() {
    setBusy(true); setError('')
    const res = await createRoom({ mode, isPublic: true })
    setBusy(false)
    if (!res?.ok) { setError(res?.error || 'Failed'); return }
    navigate(`/room/${res.room.id}`)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true); setError('')
    const res = await joinRoom(joinCode.trim().toUpperCase())
    setBusy(false)
    if (!res?.ok) { setError(res?.error || 'Room not found'); return }
    navigate(`/room/${res.room.id}`)
  }

  function handleNameSave() {
    setName(nameEdit)
  }

  return (
    <div className={styles.lobbyScreen}>
      <div className={styles.lobby}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <h1 className={styles.title}>Multiplayer</h1>
        </div>

        {/* Player name */}
        <div className={styles.nameRow}>
          <span className={styles.nameLabel}>Playing as</span>
          <div className={styles.nameInput}>
            {isRegistered ? (
              // Registered users: name is their username, not editable here
              <span className={styles.nameDisplay}>{displayName}</span>
            ) : (
              // Guests: can still edit their display name
              <input
                className={`input ${styles.nameField}`}
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                maxLength={20}
                onBlur={handleNameSave}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                aria-label="Your display name"
              />
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className={styles.modeToggle}>
          {['GTN', 'BC'].map(m => (
            <button
              key={m}
              className={`btn ${mode === m ? 'btn-juice' : 'btn-ghost'} ${styles.modeBtn}`}
              onClick={() => setMode(m)}
            >
              {m === 'GTN' ? '🎯 GTN' : '🐂 B&C'}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[['quick', '⚡ Quick Match'], ['create', '🏠 Create Room'], ['join', '🔑 Join Room']].map(([id, label]) => (
            <button
              key={id}
              className={`${styles.tab} ${tab === id ? styles.activeTab : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={`${styles.tabContent} anim-slide-up`}>
          {tab === 'quick' && (
            <div className={styles.quickPanel}>
              {state.matchmaking ? (
                <>
                  <div className={styles.spinner} aria-label="Finding opponent" />
                  <p className={styles.waitText}>Looking for an opponent…</p>
                  <button className="btn btn-ghost" onClick={cancelQuickMatch}>Cancel</button>
                </>
              ) : (
                <>
                  <p className={styles.hint}>Get matched with a random opponent instantly.</p>
                  <button className="btn btn-juice btn-lg" style={{ width: '100%' }} onClick={handleQuickMatch} disabled={busy}>
                    Find Match
                  </button>
                </>
              )}
            </div>
          )}

          {tab === 'create' && (
            <div className={styles.createPanel}>
              <p className={styles.hint}>Create a private room and share the code with a friend.</p>
              <button className="btn btn-juice btn-lg" style={{ width: '100%' }} onClick={handleCreate} disabled={busy}>
                Create Room
              </button>
            </div>
          )}

          {tab === 'join' && (
            <form className={styles.joinPanel} onSubmit={handleJoin}>
              <input
                className="input"
                placeholder="Room code (e.g. ABC123)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                aria-label="Room code"
              />
              <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }} disabled={busy || !joinCode.trim()}>
                Join Room
              </button>
            </form>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
