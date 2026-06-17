import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useSound } from '../hooks/useSound.js'
import { useHaptic } from '../hooks/useHaptic.js'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import styles from './LobbyPage.module.css'

const MODE_NAMES = { GTN: 'Guess The Number', BC: 'Bulls & Cows', XOX: 'Tic-Tac-Toe', MATH: 'Math Battle', SUDOKU: 'Sudoku', SPIN: 'Spin Battle', SOS: 'SOS', RMCS: 'Raja Mantri', RUMMY: 'Rummy', QUEENS: 'Queens', TANGO: 'Tango' }
const MODE_ICONS = { GTN: '🎯', BC: '🐂', XOX: '⭕', MATH: '🧮', SUDOKU: '🔢', SPIN: '🎡', SOS: '🔠', RMCS: '👑', RUMMY: '🃏', QUEENS: '👑', TANGO: '☀️' }
const KNOWN_MODES = new Set(['GTN', 'BC', 'XOX', 'MATH', 'SUDOKU', 'SPIN', 'SOS', 'RMCS', 'RUMMY', 'QUEENS', 'TANGO'])
const SOLO_LABEL_MODES = new Set(['MATH', 'SPIN', 'SUDOKU', 'QUEENS', 'TANGO'])  // "Solo" rather than "vs AI"

export default function LobbyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, createRoom, joinRoom, quickMatch, cancelQuickMatch, clearRoom } = useRoom()
  const { playerName, setName } = usePlayer()
  const { user, isRegistered } = useAuth()

  const displayName = isRegistered && user?.username ? user.username : playerName

  // Mode is fixed — chosen on the Home games list (router state) or via a
  // ?mode= deep-link (e.g. a push notification opening a specific game).
  const queryMode = new URLSearchParams(location.search).get('mode')
  const requestedMode = location.state?.mode || queryMode
  const mode = KNOWN_MODES.has(requestedMode) ? requestedMode : 'GTN'

  // Clear any stale room so the auto-navigate can't bounce us into a dead room.
  useEffect(() => { clearRoom() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // If we leave the lobby while still searching (e.g. Back button), cancel the
  // quick-match so we don't linger in the queue as a "ghost" opponent.
  const matchmakingRef = useRef(false)
  useEffect(() => { matchmakingRef.current = state.matchmaking }, [state.matchmaking])
  useEffect(() => () => { if (matchmakingRef.current) cancelQuickMatch() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // "Opponent found!" beat — a short celebration (flash + chime + buzz) before
  // navigating, instead of an anticlimactic instant jump into the room.
  const { playWin } = useSound()
  const { buzz } = useHaptic()
  const [found, setFound] = useState(false)
  const foundTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(foundTimerRef.current), [])
  function celebrateFound(roomId) {
    if (foundTimerRef.current) return         // already celebrating
    setFound(true)
    playWin()
    buzz('correct')
    foundTimerRef.current = setTimeout(() => navigate(`/room/${roomId}`), 850)
  }

  // Only auto-navigate when WE started matchmaking and then got paired.
  const startedMatchmakingRef = useRef(false)
  useEffect(() => {
    if (state.matchmaking) startedMatchmakingRef.current = true
    // 1v1 quick-match lands in SETUP; a grouped party match (Raja Mantri) lands
    // in LOBBY (host then starts) — accept either so grouped players navigate too.
    if (startedMatchmakingRef.current && !state.matchmaking &&
        state.room?.id && (state.room.phase === 'SETUP' || state.room.phase === 'LOBBY')) {
      startedMatchmakingRef.current = false
      celebrateFound(state.room.id)
    }
  }, [state.matchmaking, state.room?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sudoku is multiplayer-only and lets the host pick puzzle difficulty.
  const isSudoku = mode === 'SUDOKU'
  // Queens / Tango: solo + an N-player "race to solve"; host picks the difficulty.
  const isQueens = mode === 'QUEENS'
  const isTango  = mode === 'TANGO'
  const isRace   = isQueens || isTango
  // SOS carries its grid size in the `difficulty` field ('8' | '10').
  const isSos = mode === 'SOS'
  // Raja Mantri: multiplayer-only (no AI — bluffing bots is hollow), exactly 4
  // players. Quick Match groups 4 strangers into one table; Create/Join also work.
  const isRmcs = mode === 'RMCS'
  // Rummy: multiplayer-first (no AI in v1), a 2–6 player party game.
  const isRummy = mode === 'RUMMY'
  const isParty = mode === 'SPIN' || isRummy || isRace
  // Sudoku now has a full solo mode; Raja Mantri and Rummy stay multiplayer-only.
  const mpOnly = isRmcs || isRummy
  // Multiplayer is the primary option for every mode (Sudoku is MP-only anyway).
  const [topTab, setTopTab] = useState('multi')  // ai | multi
  const [mpTab, setMpTab]   = useState('quick')   // quick | create | join
  const [difficulty, setDifficulty] = useState(mode === 'SOS' ? '8' : 'medium')
  const [partySize, setPartySize] = useState(mode === 'QUEENS' || mode === 'TANGO' ? 2 : 4)   // party room size (races default to a 2-player duel)
  const [joinCode, setJoinCode] = useState('')
  const [nameEdit, setNameEdit] = useState(displayName)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Elapsed search time, shown while waiting for an opponent.
  const [searchSecs, setSearchSecs] = useState(0)
  useEffect(() => {
    if (!state.matchmaking) return
    setSearchSecs(0)
    const id = setInterval(() => setSearchSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [state.matchmaking])
  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  function playVsAI() {
    navigate(`/play/${mode}`)
  }

  async function handleQuickMatch() {
    setBusy(true); setError('')
    const res = await quickMatch(mode, difficulty)
    setBusy(false)
    if (!res?.ok) { setError(res?.error || 'Failed'); return }
    if (res.matched) celebrateFound(res.room.id)
  }

  async function handleCreate() {
    setBusy(true); setError('')
    const maxPlayers = isParty ? partySize : mode === 'RMCS' ? 4 : 2
    const res = await createRoom({ mode, isPublic: true, difficulty, maxPlayers })
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
      <AmbientOrbs />
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

        {/* Top tabs: AI vs Multiplayer — Sudoku/Raja Mantri are multiplayer-only, no AI tab */}
        {!mpOnly && (
          <div className={styles.topTabs}>
            <button
              className={`${styles.topTab} ${topTab === 'multi' ? styles.topTabActive : ''}`}
              onClick={() => setTopTab('multi')}
            >
              ⚡ Multiplayer
            </button>
            <button
              className={`${styles.topTab} ${topTab === 'ai' ? styles.topTabActive : ''}`}
              onClick={() => setTopTab('ai')}
            >
              {SOLO_LABEL_MODES.has(mode) ? '🧠 Solo' : '🤖 vs AI'}
            </button>
          </div>
        )}

        {/* ── Difficulty selector (Sudoku/Queens/Tango MP — host picks puzzle complexity) ── */}
        {(isSudoku || isRace) && topTab === 'multi' && (
          <div className={styles.tabs}>
            {[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([id, label]) => (
              <button
                key={id}
                className={`${styles.tab} ${difficulty === id ? styles.activeTab : ''}`}
                onClick={() => setDifficulty(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── AI tab ── */}
        {!mpOnly && topTab === 'ai' && (
          <div className={`${styles.tabContent} ${styles.aiPanel} anim-slide-up`}>
            <p className={styles.hint}>
              {mode === 'XOX'
                ? 'Take on the Numbskull AI at Tic-Tac-Toe. Pick X or O and try not to embarrass yourself.'
                : mode === 'MATH'
                ? '20 rapid-fire questions, just you against the clock. Sharpen your mental maths — no AI, pure practice.'
                : mode === 'SPIN'
                ? 'Solo practice: spin the wheel, call letters, and solve the phrase before five strikes end you.'
                : mode === 'SUDOKU'
                ? 'Solo Sudoku: pick Easy, Medium or Hard and race the clock. Notes, hints and 3 lives — three mistakes and you’re out.'
                : mode === 'QUEENS'
                ? 'Solo Queens: one 👑 per row, column & color region — none touching. Pick a size and beat your best time.'
                : mode === 'TANGO'
                ? 'Solo Tango: fill ☀️/🌙 — 3 each per row & column, no 3 in a row, obey =/×. Beat your best time.'
                : 'Face the Numbskull AI solo. It holds a secret — you crack it. No waiting, no mercy.'}
            </p>
            <button className={`btn btn-juice btn-lg ${styles.cta}`} style={{ width: '100%' }} onClick={playVsAI}>
              {SOLO_LABEL_MODES.has(mode) ? '🧠 Start Solo Practice' : '🤖 Play vs Computer'}
            </button>
          </div>
        )}

        {/* ── Multiplayer tab ── (always shown for MP-only modes) */}
        {(mpOnly || topTab === 'multi') && (
          <>
            {isSos && (
              <div className={styles.tabs} style={{ marginBottom: 'var(--space-3, 12px)' }}>
                {[['8', '8 × 8'], ['10', '10 × 10']].map(([v, label]) => (
                  <button
                    key={v}
                    className={`${styles.tab} ${difficulty === v ? styles.activeTab : ''}`}
                    onClick={() => setDifficulty(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
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
                  {found ? (
                    <div className={styles.foundCard} role="status">
                      <span className={styles.foundIcon}>⚔️</span>
                      <span className={styles.foundText}>Opponent found!</span>
                    </div>
                  ) : state.matchmaking ? (
                    <>
                      <div className={styles.spinner} aria-label="Finding players" />
                      <p className={styles.waitText}>
                        {isRmcs ? 'Finding 4 players for your table…' : 'Looking for an opponent…'} <b>{fmtSecs(searchSecs)}</b>
                      </p>
                      <button className="btn btn-ghost" onClick={cancelQuickMatch}>Cancel</button>
                    </>
                  ) : state.matchmakingTimedOut ? (
                    <>
                      <p className={styles.hint}>
                        {isRmcs
                          ? '😴 Couldn’t find 4 players in time. Try again, or create a room and invite friends.'
                          : '😴 No opponent showed up. Want to try again, or create a room and share the code?'}
                      </p>
                      <button className={`btn btn-juice btn-lg ${styles.cta}`} style={{ width: '100%' }} onClick={handleQuickMatch} disabled={busy}>
                        Try Again
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setMpTab('create')}>Create a room instead</button>
                    </>
                  ) : (
                    <>
                      <p className={styles.hint}>
                        {isRmcs
                          ? 'Get grouped with 3 random players into a Raja Mantri table.'
                          : 'Get matched with a random opponent instantly.'}
                      </p>
                      <button className={`btn btn-juice btn-lg ${styles.cta}`} style={{ width: '100%' }} onClick={handleQuickMatch} disabled={busy}>
                        Find Match
                      </button>
                    </>
                  )}
                </div>
              )}

              {mpTab === 'create' && (
                <div className={styles.createPanel}>
                  <p className={styles.hint}>
                    {mode === 'SPIN'
                      ? 'Create a party room and share the code. The host starts when everyone’s in.'
                      : isQueens
                      ? 'Create a Queens race (2–8 players) and share the code. Everyone solves the same board — fastest wins. The host starts when everyone’s in.'
                      : isTango
                      ? 'Create a Tango race (2–8 players) and share the code. Everyone solves the same board — fastest wins. The host starts when everyone’s in.'
                      : isRummy
                      ? 'Create a Rummy table (2–6 players) and share the code. The host starts when everyone’s in.'
                      : mode === 'RMCS'
                      ? 'Create a room and share the code with 3 friends — Raja Mantri needs exactly 4 players.'
                      : 'Create a private room and share the code with a friend.'}
                  </p>
                  {isParty && (
                    <div className={styles.tabs} style={{ marginBottom: 'var(--space-3, 12px)' }}>
                      {(isRummy ? [2, 3, 4, 5, 6] : [2, 3, 4, 6, 8]).map(n => (
                        <button
                          key={n}
                          className={`${styles.tab} ${partySize === n ? styles.activeTab : ''}`}
                          onClick={() => setPartySize(n)}
                        >
                          {n}P
                        </button>
                      ))}
                    </div>
                  )}
                  <button className={`btn btn-juice btn-lg ${styles.cta}`} style={{ width: '100%' }} onClick={handleCreate} disabled={busy}>
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
                  <button type="submit" className={`btn btn-juice btn-lg ${styles.cta}`} style={{ width: '100%' }} disabled={busy || !joinCode.trim()}>
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
