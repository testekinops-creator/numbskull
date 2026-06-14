import { useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import GameLogo from '../components/GameLogo.jsx'
import SocialLoginButtons from '../components/auth/SocialLoginButtons.jsx'
import { setGuestMode } from './AuthGatePage.jsx'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isRegistered } = useAuth()
  const { playerId } = usePlayer()

  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in (e.g. browser Back onto this page) → go to the app.
  // (After all hooks, so hook order stays stable.)
  if (isRegistered) return <Navigate to="/home" replace />

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await register({ ...form, guestId: playerId })
      localStorage.setItem('ns_name_set', '1')
      navigate('/home')
    } catch (err) {
      let msg
      if (err.code === 'EMAIL_EXISTS') msg = 'That email is already registered — try logging in.'
      else if (err.code === 'USERNAME_EXISTS') msg = 'That username is taken — pick another.'
      else if (!err.status || err.status >= 500) msg = 'Couldn’t reach the server. Check your connection and try again.'
      else msg = err.message || 'Registration failed.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.authCard}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/auth')} style={{ alignSelf: 'flex-start' }}>
          ← Back
        </button>
        <div className={styles.top}>
          <GameLogo variant="static" size={72} />
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.sub}>Save your stats. Challenge friends. Never lose your wins.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email
            <input className="input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
          </label>
          <label className={styles.label}>
            Username
            <input className="input" type="text" value={form.username} onChange={set('username')} required minLength={2} maxLength={20} placeholder="CoolPlayer99" autoComplete="username" />
            <span className={styles.fieldHint}>2–20 chars, letters/numbers/_/-</span>
          </label>
          <label className={styles.label}>
            Password
            <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} placeholder="Min 8 characters" autoComplete="new-password" />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <SocialLoginButtons
          onGuest={() => { setGuestMode(); localStorage.setItem('ns_name_set', '1'); navigate('/home') }}
          onDone={() => { localStorage.setItem('ns_name_set', '1'); navigate('/home') }}
        />

        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Log in</Link>
          {' · '}<Link to="/auth">Back</Link>
        </p>
      </div>
    </div>
  )
}
