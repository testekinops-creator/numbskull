import { Routes, Route } from 'react-router-dom'
import { useState, useEffect, Suspense } from 'react'
import { lazyWithRetry } from './utils/lazyWithRetry.js'
import { GameProvider }      from './contexts/GameContext.jsx'
import { PlayerProvider }    from './contexts/PlayerContext.jsx'
import { SocketProvider }    from './contexts/SocketContext.jsx'
import { RoomProvider }      from './contexts/RoomContext.jsx'
import { AuthProvider }      from './contexts/AuthContext.jsx'
import GDPRBanner            from './components/GDPRBanner.jsx'
import PWAInstallBanner      from './components/PWAInstallBanner.jsx'
import BadgeToast            from './components/BadgeToast.jsx'
import SystemToast           from './components/SystemToast.jsx'
import ConnectionBanner      from './components/ConnectionBanner.jsx'
import GameMusic             from './components/GameMusic.jsx'
import MusicToggle           from './components/MusicToggle.jsx'
import ErrorBoundary         from './components/ErrorBoundary.jsx'
import Loader                from './components/Loader.jsx'
import { initAnalytics }     from './services/analytics.js'
import { SkipLink, useColorblindMode } from './components/AppShell.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { useButtonHaptics } from './hooks/useButtonHaptics.js'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx'

// Eagerly loaded (critical path — first paint)
import TitleScreen           from './pages/TitleScreen.jsx'
import GamePage              from './pages/GamePage.jsx'
import ProtectedRoute        from './components/ProtectedRoute.jsx'

// Lazily loaded
const AuthGatePage        = lazyWithRetry(() => import('./pages/AuthGatePage.jsx'))
const HomeListPage        = lazyWithRetry(() => import('./pages/HomeListPage.jsx'))
const NameSetupScreen     = lazyWithRetry(() => import('./pages/NameSetupScreen.jsx'))
const ModeSelectPage      = lazyWithRetry(() => import('./pages/ModeSelectPage.jsx'))
const LobbyPage           = lazyWithRetry(() => import('./pages/LobbyPage.jsx'))
const RoomPage            = lazyWithRetry(() => import('./pages/RoomPage.jsx'))
const SpectatorPage       = lazyWithRetry(() => import('./pages/SpectatorPage.jsx'))
const DailyChallengePage  = lazyWithRetry(() => import('./pages/DailyChallengePage.jsx'))
const LeaderboardPage     = lazyWithRetry(() => import('./pages/LeaderboardPage.jsx'))
const BadgesPage          = lazyWithRetry(() => import('./pages/BadgesPage.jsx'))
const RegisterPage        = lazyWithRetry(() => import('./pages/RegisterPage.jsx'))
const LoginPage           = lazyWithRetry(() => import('./pages/LoginPage.jsx'))
const ProfilePage         = lazyWithRetry(() => import('./pages/ProfilePage.jsx'))
const FriendsPage         = lazyWithRetry(() => import('./pages/FriendsPage.jsx'))
const ReplayTheaterPage   = lazyWithRetry(() => import('./pages/ReplayTheaterPage.jsx'))
const AdminPage           = lazyWithRetry(() => import('./pages/AdminPage.jsx'))
const CountdownPage       = lazyWithRetry(() => import('./pages/CountdownPage.jsx'))
const NumberChainPage     = lazyWithRetry(() => import('./pages/NumberChainPage.jsx'))
const NumberTowersPage    = lazyWithRetry(() => import('./pages/NumberTowersPage.jsx'))
const SettingsPage        = lazyWithRetry(() => import('./pages/SettingsPage.jsx'))
const XoxAiPage           = lazyWithRetry(() => import('./pages/XoxAiPage.jsx'))
const MathBattleAiPage    = lazyWithRetry(() => import('./pages/MathBattleAiPage.jsx'))
const SpinBattleAiPage    = lazyWithRetry(() => import('./pages/SpinBattleAiPage.jsx'))
const SosAiPage           = lazyWithRetry(() => import('./pages/SosAiPage.jsx'))
const SudokuSoloPage      = lazyWithRetry(() => import('./pages/SudokuSoloPage.jsx'))
const NotFoundPage        = lazyWithRetry(() => import('./pages/NotFoundPage.jsx'))

function PageFallback() {
  // Never let a slow/stalled chunk leave the user staring at a spinner forever:
  // after a few seconds, surface a reload escape hatch.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center' }}>
      <Loader label={slow ? 'Still loading…' : 'Loading…'} />
      {slow && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '30ch', margin: 0 }}>
            This is taking a while — your connection may be slow or unstable.
          </p>
          <button className="btn btn-juice" onClick={() => window.location.reload()}>Reload</button>
        </>
      )}
    </div>
  )
}

function AppInner() {
  const [showShortcuts, setShowShortcuts] = useState(false)
  useKeyboardShortcuts(() => setShowShortcuts(s => !s))
  useButtonHaptics()

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Public (no auth needed) ───────────────────────── */}
          <Route path="/"                   element={<TitleScreen />} />
          <Route path="/auth"               element={<AuthGatePage />} />
          <Route path="/register"           element={<RegisterPage />} />
          <Route path="/login"              element={<LoginPage />} />

          {/* ── Protected (requires auth or guest mode) ───────── */}
          <Route path="/home"               element={<ProtectedRoute><HomeListPage /></ProtectedRoute>} />
          <Route path="/setup"              element={<ProtectedRoute><NameSetupScreen /></ProtectedRoute>} />
          <Route path="/modes"              element={<ProtectedRoute><ModeSelectPage /></ProtectedRoute>} />
          {/* New-mode AI pages must precede the generic /play/:mode */}
          <Route path="/play/XOX"           element={<ProtectedRoute><XoxAiPage /></ProtectedRoute>} />
          <Route path="/play/MATH"          element={<ProtectedRoute><MathBattleAiPage /></ProtectedRoute>} />
          <Route path="/play/SPIN"          element={<ProtectedRoute><SpinBattleAiPage /></ProtectedRoute>} />
          <Route path="/play/SOS"           element={<ProtectedRoute><SosAiPage /></ProtectedRoute>} />
          <Route path="/play/SUDOKU"        element={<ProtectedRoute><SudokuSoloPage /></ProtectedRoute>} />
          <Route path="/play/:mode"         element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/lobby"              element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/room/:roomId"       element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
          <Route path="/spectate"           element={<ProtectedRoute><SpectatorPage /></ProtectedRoute>} />
          <Route path="/spectate/:roomId"   element={<ProtectedRoute><SpectatorPage /></ProtectedRoute>} />
          <Route path="/daily"              element={<ProtectedRoute><DailyChallengePage /></ProtectedRoute>} />
          <Route path="/leaderboard"        element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/leaderboard/:type"  element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
          <Route path="/badges"             element={<ProtectedRoute><BadgesPage /></ProtectedRoute>} />
          <Route path="/theater"            element={<ProtectedRoute><ReplayTheaterPage /></ProtectedRoute>} />
          <Route path="/theater/:id"        element={<ProtectedRoute><ReplayTheaterPage /></ProtectedRoute>} />
          <Route path="/countdown"          element={<ProtectedRoute><CountdownPage /></ProtectedRoute>} />
          <Route path="/chain"              element={<ProtectedRoute><NumberChainPage /></ProtectedRoute>} />
          <Route path="/towers"             element={<ProtectedRoute><NumberTowersPage /></ProtectedRoute>} />
          <Route path="/profile"            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/friends"            element={<FriendsPage />} />
          <Route path="/settings"           element={<SettingsPage />} />
          <Route path="/admin"              element={<AdminPage />} />
          <Route path="*"                   element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {/* Global overlays — stay across all routes */}
      <GDPRBanner />
      <PWAInstallBanner />
      <ConnectionBanner />
      <GameMusic />
      <MusicToggle />
      <BadgeToast />
      <SystemToast />
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}

export default function App() {
  useEffect(() => {
    initAnalytics()
    // Best-effort portrait lock for installed PWAs. The manifest alone wasn't
    // being enforced on some devices (the app settled in landscape on launch),
    // so we also lock at runtime. Only works in an installed/fullscreen PWA on
    // Android; iOS and desktop ignore it (and some browsers throw synchronously
    // when unsupported — hence the guard + catch).
    try {
      const o = window.screen?.orientation
      if (o?.lock) o.lock('portrait').catch(() => {})
    } catch { /* orientation lock unavailable — nothing to do */ }
  }, [])
  useColorblindMode()

  return (
    <>
      <SkipLink />
      <PlayerProvider>
        <AuthProvider>
          <GameProvider>
            <SocketProvider>
              <RoomProvider>
                <ErrorBoundary>
                  <AppInner />
                </ErrorBoundary>
              </RoomProvider>
            </SocketProvider>
          </GameProvider>
        </AuthProvider>
      </PlayerProvider>
    </>
  )
}
