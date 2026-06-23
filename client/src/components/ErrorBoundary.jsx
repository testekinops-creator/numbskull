import { Component } from 'react'
import { trackEvent } from '../services/analytics.js'

// Catches render/runtime errors anywhere in the tree and shows a recovery screen
// instead of a permanent white page. Everything here is INLINE-STYLED on purpose:
// this screen must look premium even when the app's CSS bundle failed to load
// (a stale-service-worker / chunk-mismatch is one of the main reasons we'd ever
// land here), so it can't depend on global classes or CSS modules.
const S = {
  screen: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    textAlign: 'center',
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: '#EEEDFE',
    background:
      'radial-gradient(120% 80% at 50% 0%, rgba(124,77,255,0.18), transparent 60%), #14102B',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: '34px 26px',
    boxSizing: 'border-box',
    borderRadius: 20,
    background: 'linear-gradient(160deg, #2a2350, #16132f)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 22px 60px rgba(0,0,0,0.55), 0 0 44px rgba(124,77,255,0.14)',
  },
  badge: {
    width: 64,
    height: 64,
    margin: '0 auto 18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    background: 'radial-gradient(circle at 50% 32%, #5cfaff, #7c4dff)',
    boxShadow: '0 8px 24px rgba(0,245,255,0.32), inset 0 2px 6px rgba(255,255,255,0.45)',
  },
  title: { margin: '0 0 10px', fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' },
  text: { margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.55, color: '#AFA9EC' },
  actions: { display: 'flex', flexDirection: 'column', gap: 10 },
  reload: {
    height: 50,
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 800,
    color: '#0A0820',
    background: 'linear-gradient(180deg, #5cfaff, #00f5ff)',
    boxShadow: '0 6px 18px rgba(0,245,255,0.35)',
  },
  home: {
    height: 46,
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#EEEDFE',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
  },
}

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    try {
      trackEvent('error_boundary', { message: String(error?.message || error).slice(0, 200) })
    } catch { /* noop */ }
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={S.screen}>
        <div style={S.card}>
          <div style={S.badge} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg>
          </div>
          <h1 style={S.title}>Well, that broke.</h1>
          <p style={S.text}>Something glitched on our end. A quick reload usually sorts it — we'll pretend this never happened.</p>
          <div style={S.actions}>
            <button style={S.reload} onClick={() => window.location.reload()}>↻ Reload</button>
            <button style={S.home} onClick={() => { window.location.href = '/' }}>Go Home</button>
          </div>
        </div>
      </div>
    )
  }
}
