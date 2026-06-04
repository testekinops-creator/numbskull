import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(form)
      localStorage.setItem('ns_name_set', '1')
      navigate('/home')
    } catch (err) {
      setError(err.code === 'ACCOUNT_LOCKED' ? 'Account locked after too many attempts. Try in 15 minutes.' : 'Invalid email or password.')
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
          <SkullMascot expression="judging" size={72} />
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.sub}>I've been waiting. Judging.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email or Username
            <input className="input" type="text" value={form.email} onChange={set('email')} required autoComplete="username" placeholder="you@example.com or your username" />
          </label>
          <label className={styles.label}>
            Password
            <input className="input" type="password" value={form.password} onChange={set('password')} required autoComplete="current-password" placeholder="Your password" />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className="btn btn-juice btn-lg" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Logging in…' : 'Log In'}
          </button>
        </form>

        <p className={styles.switchLink}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
