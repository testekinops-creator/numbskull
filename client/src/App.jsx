import { Routes, Route } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { GameProvider }      from './contexts/GameContext.jsx'
import { PlayerProvider }    from './contexts/PlayerContext.jsx'
import { SocketProvider }    from './contexts/SocketContext.jsx'
import { RoomProvider }      from './contexts/RoomContext.jsx'
import { AuthProvider }      from './contexts/AuthContext.jsx'
import GDPRBanner            from './components/GDPRBanner.jsx'
import PWAInstallBanner      from './components/PWAInstallBanner.jsx'
import { initAnalytics }     from './services/analytics.js'
import { SkipLink, useColorblindMode } from './components/AppShell.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx'

// Eagerly loaded (critical path — first paint)
import TitleScreen           from './pages/TitleScreen.jsx'
import GamePage              from './pages/GamePage.jsx'

// Lazily loaded
const AuthGatePage        = lazy(() => import('./pages/AuthGatePage.jsx'))
const NameSetupScreen     = lazy(() => import('./pages/NameSetupScreen.jsx'))
const ModeSelectPage      = lazy(() => import('./pages/ModeSelectPage.jsx'))
const LobbyPage           = lazy(() => import('./pages/LobbyPage.jsx'))
const RoomPage            = lazy(() => import('./pages/RoomPage.jsx'))
const SpectatorPage       = lazy(() => import('./pages/SpectatorPage.jsx'))
const DailyChallengePage  = lazy(() => import('./pages/DailyChallengePage.jsx'))
const LeaderboardPage     = lazy(() => import('./pages/LeaderboardPage.jsx'))
const BadgesPage          = lazy(() => import('./pages/BadgesPage.jsx'))
const RegisterPage        = lazy(() => import('./pages/RegisterPage.jsx'))
const LoginPage           = lazy(() => import('./pages/LoginPage.jsx'))
const ProfilePage         = lazy(() => import('./pages/ProfilePage.jsx'))
const FriendsPage         = lazy(() => import('./pages/FriendsPage.jsx'))
const ReplayTheaterPage   = lazy(() => import('./pages/ReplayTheaterPage.jsx'))
const AdminPage           = lazy(() => import('./pages/AdminPage.jsx'))
const CountdownPage       = lazy(() => import('./pages/CountdownPage.jsx'))
const NumberChainPage     = lazy(() => import('./pages/NumberChainPage.jsx'))
const NumberTowersPage    = lazy(() => import('./pages/NumberTowersPage.jsx'))
const SettingsPage        = lazy(() => import('./pages/SettingsPage.jsx'))

function PageFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', color: 'var(--color-text-muted)' }}>
      Loading…
    </div>
  )
}

function AppInner() {
  const [showShortcuts, setShowShortcuts] = useState(false)
  useKeyboardShortcuts(() => setShowShortcuts(s => !s))

  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Game flow ─────────────────────────────────────── */}
          <Route path="/"                   element={<TitleScreen />} />
          <Route path="/auth"               element={<AuthGatePage />} />
          <Route path="/setup"              element={<NameSetupScreen />} />
          <Route path="/modes"              element={<ModeSelectPage />} />
          <Route path="/play/:mode"         element={<GamePage />} />

          {/* ── Multiplayer ───────────────────────────────────── */}
          <Route path="/lobby"              element={<LobbyPage />} />
          <Route path="/room/:roomId"       element={<RoomPage />} />
          <Route path="/spectate"           element={<SpectatorPage />} />
          <Route path="/spectate/:roomId"   element={<SpectatorPage />} />

          {/* ── Engagement (via MoreDrawer) ───────────────────── */}
          <Route path="/daily"              element={<DailyChallengePage />} />
          <Route path="/leaderboard"        element={<LeaderboardPage />} />
          <Route path="/leaderboard/:type"  element={<LeaderboardPage />} />
          <Route path="/badges"             element={<BadgesPage />} />
          <Route path="/theater"            element={<ReplayTheaterPage />} />
          <Route path="/theater/:id"        element={<ReplayTheaterPage />} />

          {/* ── More modes (via MoreDrawer) ───────────────────── */}
          <Route path="/countdown"          element={<CountdownPage />} />
          <Route path="/chain"              element={<NumberChainPage />} />
          <Route path="/towers"             element={<NumberTowersPage />} />

          {/* ── Account ──────────────────────────────────────── */}
          <Route path="/register"           element={<RegisterPage />} />
          <Route path="/login"              element={<LoginPage />} />
          <Route path="/profile"            element={<ProfilePage />} />
          <Route path="/friends"            element={<FriendsPage />} />
          <Route path="/settings"           element={<SettingsPage />} />
          <Route path="/admin"              element={<AdminPage />} />
        </Routes>
      </Suspense>

      {/* Global overlays — stay across all routes */}
      <GDPRBanner />
      <PWAInstallBanner />
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  )
}

export default function App() {
  useEffect(() => { initAnalytics() }, [])
  useColorblindMode()

  return (
    <>
      <SkipLink />
      <PlayerProvider>
        <AuthProvider>
          <GameProvider>
            <SocketProvider>
              <RoomProvider>
                <AppInner />
              </RoomProvider>
            </SocketProvider>
          </GameProvider>
        </AuthProvider>
      </PlayerProvider>
    </>
  )
}
