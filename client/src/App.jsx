import { Routes, Route } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { GameProvider }      from './contexts/GameContext.jsx'
import { PlayerProvider }    from './contexts/PlayerContext.jsx'
import { SocketProvider }    from './contexts/SocketContext.jsx'
import { RoomProvider }      from './contexts/RoomContext.jsx'
import { AuthProvider }      from './contexts/AuthContext.jsx'
import GDPRBanner            from './components/GDPRBanner.jsx'
import PWAInstallBanner      from './components/PWAInstallBanner.jsx'
import BadgeToast            from './components/BadgeToast.jsx'
import ErrorBoundary         from './components/ErrorBoundary.jsx'
import { initAnalytics }     from './services/analytics.js'
import { SkipLink, useColorblindMode } from './components/AppShell.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx'

// Eagerly loaded (critical path — first paint)
import TitleScreen           from './pages/TitleScreen.jsx'
import GamePage              from './pages/GamePage.jsx'
import ProtectedRoute        from './components/ProtectedRoute.jsx'

// Lazily loaded
const AuthGatePage        = lazy(() => import('./pages/AuthGatePage.jsx'))
const HomeListPage        = lazy(() => import('./pages/HomeListPage.jsx'))
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
const XoxAiPage           = lazy(() => import('./pages/XoxAiPage.jsx'))
const MathBattleAiPage    = lazy(() => import('./pages/MathBattleAiPage.jsx'))
const SpinBattleAiPage    = lazy(() => import('./pages/SpinBattleAiPage.jsx'))
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage.jsx'))

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
      <BadgeToast />
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
