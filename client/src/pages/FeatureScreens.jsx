// Thin route wrappers for the drop-in Numbskull feature screens. Each connects
// the screen's navigation callbacks to the router; data props use the screens'
// built-in defaults for now (pass real data here to make them live).
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { levelProgress } from '../utils/progression.js'
import {
  MatchHistoryScreen, LevelUpScreen, StreakScreen,
  SkullCustomizerScreen, DifficultyScreen, MultiplayerTutorialScreen,
} from '../components/numbskull-screens'

export function HistoryPage() {
  const navigate = useNavigate()
  return <MatchHistoryScreen onBack={() => navigate(-1)} />
}

export function LevelUpPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Real level + XP bar (matches the Profile card); the XP-breakdown rows inside
  // the screen are illustrative until a real level-up event feeds them.
  const lp = levelProgress(user?.xp ?? 0)
  return (
    <LevelUpScreen
      level={user?.level ?? lp.level}
      xp={lp.into}
      xpMax={lp.span}
      onPrimary={() => navigate('/home')}
    />
  )
}

export function StreakPage() {
  const navigate = useNavigate()
  return <StreakScreen onBack={() => navigate(-1)} onPrimary={() => navigate('/daily')} />
}

export function SkullPage() {
  const navigate = useNavigate()
  return <SkullCustomizerScreen onBack={() => navigate(-1)} onPrimary={() => navigate(-1)} />
}

export function DifficultyPage() {
  const navigate = useNavigate()
  return <DifficultyScreen onBack={() => navigate(-1)} onSelect={() => navigate('/home')} onPrimary={() => navigate('/home')} />
}

export function MpTutorialPage() {
  const navigate = useNavigate()
  return <MultiplayerTutorialScreen onSkip={() => navigate(-1)} onNext={() => navigate(-1)} />
}
