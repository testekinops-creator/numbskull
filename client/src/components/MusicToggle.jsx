import { useLocation } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { modeForRoute, useMusicEnabled } from '../services/gameMusic.js'

// Floating enable/disable button for the in-game music. Only shows while you're
// in a game; sits at the bottom (raised above the chat bar inside rooms).
export default function MusicToggle() {
  const { pathname } = useLocation()
  const { state } = useRoom()
  const [enabled, setEnabled] = useMusicEnabled()
  const onGame = !!modeForRoute(pathname, state?.room?.mode)
  if (!onGame) return null

  // Every room AND every /play game page now hosts music in the action dock, so
  // the standalone floating button is only for the other solo minigames
  // (countdown / chain / towers / daily).
  const hasDock = pathname.startsWith('/room/') || pathname.startsWith('/play/')
  if (hasDock) return null

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      aria-label={enabled ? 'Turn music off' : 'Turn music on'}
      aria-pressed={enabled}
      title={enabled ? 'Music on' : 'Music off'}
      style={{
        position: 'fixed',
        right: 14,
        bottom: 'calc(var(--safe-bottom, 0px) + 18px)',
        zIndex: 1100,
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: enabled ? 'var(--color-juice)' : 'var(--color-text-muted)',
        background: enabled ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${enabled ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: enabled
          ? '0 0 16px rgba(0,245,255,0.35), inset 0 0 10px rgba(0,245,255,0.1)'
          : '0 4px 12px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'color 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="18" r="3" fill="currentColor" />
        <circle cx="16" cy="16" r="3" fill="currentColor" />
        {!enabled && <line x1="3" y1="2.5" x2="21.5" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    </button>
  )
}
