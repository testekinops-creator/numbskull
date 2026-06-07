import { useSocket } from '../contexts/SocketContext.jsx'

// Shows a small banner whenever the socket drops and is trying to reconnect, so
// players understand a stall is their connection (not a frozen game).
export default function ConnectionBanner() {
  const { reconnecting } = useSocket()
  if (!reconnecting) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top, 0px) + 8px)',
        left: 0,
        right: 0,
        margin: '0 auto',
        width: 'max-content',
        maxWidth: '92vw',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 999,
        background: 'rgba(20, 16, 48, 0.96)',
        border: '1px solid var(--color-warning, #ffd740)',
        color: '#fff',
        fontWeight: 700,
        fontSize: '0.85rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning, #ffd740)', animation: 'glow-breathe 1.2s ease-in-out infinite' }} />
      Reconnecting…
    </div>
  )
}
