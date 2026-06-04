import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const { playerId } = usePlayer()

  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await register({ ...form, guestId: playerId })
      localStorage.setItem('ns_name_set', '1')
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Registration failed')
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
          <SkullMascot expression="neutral" size={72} />
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

        <div className={styles.oauthRow}>
          <button className={`btn btn-ghost ${styles.oauthBtn}`} disabled title="Coming soon">
            <GoogleIcon /> Continue with Google
          </button>
        </div>

        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Log in</Link>
          {' · '}<Link to="/auth">Back</Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.48h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.566 2.684-3.874 2.684-6.614z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}
