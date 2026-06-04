import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import styles from './LobbyPage.module.css'

const MODE_NAMES = { GTN: 'Guess The Number', BC: 'Bulls & Cows', XOX: 'Tic-Tac-Toe', MATH: 'Math Battle', SUDOKU: 'Sudoku' }
const MODE_ICONS = { GTN: '🎯', BC: '🐂', XOX: '⭕', MATH: '🧮', SUDOKU: '🔢' }
const KNOWN_MODES = new Set(['GTN', 'BC', 'XOX', 'MATH', 'SUDOKU'])

export default function LobbyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, createRoom, joinRoom, quickMatch, cancelQuickMatch, clearRoom } = useRoom()
  const { playerName, setName } = usePlayer()
  const { user, isRegistered } = useAuth()

  const displayName = isRegistered && user?.username ? user.username : playerName

  // Mode is fixed — chosen on the Home games list. No in-page toggle.
  const mode = KNOWN_MODES.has(location.state?.mode) ? location.state.mode : 'GTN'

  // Clear any stale room so the auto-navigate can't bounce us into a dead room.
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

  const [topTab, setTopTab] = useState('ai')      // ai | multi
  const [mpTab, setMpTab]   = useState('quick')   // quick | create | join
  const [joinCode, setJoinCode] = useState('')
  const [nameEdit, setNameEdit] = useState(displayName)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function playVsAI() {
    navigate(`/play/${mode}`)
  }

  async function handleQuickMatch() {
    setBusy(true); setError('')
    const res = await quickMatch(mode)
    setBusy(false)
    if (!res?.ok) { setError(res?.error || 'Failed'); return }
    if (res.matched) navigate(`/room/${res.room.id}`)
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

  function handleNameSave() { setName(nameEdit) }

  return (
    <div className={styles.lobbyScreen}>
      <div className={styles.lobby}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>← Back</button>
          <h1 className={styles.title}>
            {MODE_ICONS[mode]} {MODE_NAMES[mode]}
          </h1>
        </div>

        {/* Player name */}
        <div className={styles.nameRow}>
          <span className={styles.nameLabel}>Playing as</span>
          <div className={styles.nameInput}>
            {isRegistered ? (
              <span className={styles.nameDisplay}>{displayName}</span>
            ) : (
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

        {/* Top tabs: AI vs Multiplayer */}
        <div className={styles.topTabs}>
          <button
            className={`${styles.topTab} ${topTab === 'ai' ? styles.topTabActive : ''}`}
            onClick={() => setTopTab('ai')}
          >
            🤖 vs AI
          </button>
          <button
            className={`${styles.topTab} ${topTab === 'multi' ? styles.topTabActive : ''}`}
            onClick={() => setTopTab('multi')}
          >
            ⚡ Multiplayer
          </button>
        </div>

        {/* ── AI tab ── */}
        {topTab === 'ai' && (
          <div className={`${styles.tabContent} ${styles.aiPanel} anim-slide-up`}>
            <p className={styles.hint}>
              {mode === 'XOX'
                ? 'Take on the Numbskull AI at Tic-Tac-Toe. Pick X or O and try not to embarrass yourself.'
                : 'Face the Numbskull AI solo. It holds a secret — you crack it. No waiting, no mercy.'}
            </p>
            <button className="btn btn-juice btn-lg" style={{ width: '100%' }} onClick={playVsAI}>
              🤖 Play vs Computer
            </button>
          </div>
        )}

        {/* ── Multiplayer tab ── */}
        {topTab === 'multi' && (
          <>
            <div className={styles.tabs}>
              {[['quick', '⚡ Quick Match'], ['create', '🏠 Create Room'], ['join', '🔑 Join Room']].map(([id, label]) => (
                <button
                  key={id}
                  className={`${styles.tab} ${mpTab === id ? styles.activeTab : ''}`}
                  onClick={() => setMpTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={`${styles.tabContent} anim-slide-up`}>
              {mpTab === 'quick' && (
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

              {mpTab === 'create' && (
                <div className={styles.createPanel}>
                  <p className={styles.hint}>Create a private room and share the code with a friend.</p>
                  <button className="btn btn-juice btn-lg" style={{ width: '100%' }} onClick={handleCreate} disabled={busy}>
                    Create Room
                  </button>
                </div>
              )}

              {mpTab === 'join' && (
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
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
