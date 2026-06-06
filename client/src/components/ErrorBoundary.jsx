import { Component } from 'react'
import SkullMascot from './skull/SkullMascot.jsx'
import { trackEvent } from '../services/analytics.js'
import styles from './ErrorBoundary.module.css'

// Catches render/runtime errors anywhere in the tree and shows a recovery
// screen instead of a permanent white page. Class component because Error
// Boundaries require getDerivedStateFromError / componentDidCatch.
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
      <div className={styles.screen}>
        <div className={`${styles.card} anim-bounce-land`}>
          <SkullMascot expression="annoyed" size={110} glow />
          <h1 className={styles.title}>Well, that broke.</h1>
          <p className={styles.text}>
            Something went wrong — even the skull looks embarrassed. Give it a reload.
          </p>
          <div className={styles.actions}>
            <button className="btn btn-juice btn-lg" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="btn btn-ghost" onClick={() => { window.location.href = '/' }}>
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
