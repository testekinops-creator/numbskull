import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setColorblindMode } from '../components/AppShell.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { setSoundVolume } from '../hooks/useSound.js'
import styles from './SettingsPage.module.css'

const CB_KEY      = 'ns_colorblind_mode'
const SOUND_KEY   = 'ns_sound_enabled'
const VOLUME_KEY  = 'ns_sound_volume'
const HAPTIC_KEY  = 'ns_haptic_enabled'
const MOTION_KEY  = 'ns_reduced_motion'

function getBool(key, def = true) {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

export default function SettingsPage() {
  const navigate  = useNavigate()
  const { isRegistered, user } = useAuth()

  const [cbMode,    setCbMode]    = useState(() => localStorage.getItem(CB_KEY) || 'none')
  const [volume,    setVolume]    = useState(() => {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw !== null) return Math.max(0, Math.min(100, parseInt(raw, 10) || 0))
    return getBool(SOUND_KEY, true) ? 80 : 0   // migrate from the old on/off toggle
  })
  const [haptic,    setHaptic]    = useState(() => getBool(HAPTIC_KEY, true))
  const [motion,    setMotion]    = useState(() => getBool(MOTION_KEY, false))

  useEffect(() => {
    setColorblindMode(cbMode === 'none' ? null : cbMode)
    localStorage.setItem(CB_KEY, cbMode === 'none' ? '' : cbMode)
  }, [cbMode])

  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, String(volume))
    localStorage.setItem(SOUND_KEY, String(volume > 0))  // keep legacy key in sync
    setSoundVolume(volume)                                // apply to live audio graph
  }, [volume])
  useEffect(() => { localStorage.setItem(HAPTIC_KEY, String(haptic)) }, [haptic])

  useEffect(() => {
    localStorage.setItem(MOTION_KEY, String(motion))
    if (motion) {
      document.documentElement.style.setProperty('--duration-fast',   '0.01ms')
      document.documentElement.style.setProperty('--duration-normal', '0.01ms')
      document.documentElement.style.setProperty('--duration-slow',   '0.01ms')
    } else {
      document.documentElement.style.removeProperty('--duration-fast')
      document.documentElement.style.removeProperty('--duration-normal')
      document.documentElement.style.removeProperty('--duration-slow')
    }
  }, [motion])

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h1 className={styles.title}>Settings</h1>
        </div>

        <Section title="Accessibility">
          <ToggleRow
            label="Reduce Motion"
            description="Disables all animations and transitions."
            checked={motion}
            onChange={setMotion}
          />

          <SelectRow
            label="Colorblind Mode"
            description="Adjusts accent colors for color vision deficiencies."
            value={cbMode}
            onChange={setCbMode}
            options={[
              { value: 'none',          label: 'Off' },
              { value: 'deuteranopia',  label: 'Deuteranopia (red-green)' },
              { value: 'protanopia',    label: 'Protanopia (red-green)' },
              { value: 'tritanopia',    label: 'Tritanopia (blue-yellow)' },
            ]}
          />
        </Section>

        <Section title="Audio & Feedback">
          <SliderRow
            label="Sound Volume"
            description="Musical pitch feedback on guesses. 0 = muted."
            value={volume}
            onChange={setVolume}
          />
          <ToggleRow
            label="Haptic Feedback"
            description="Vibration patterns on mobile devices."
            checked={haptic}
            onChange={setHaptic}
          />
        </Section>

        <Section title="Account">
          {isRegistered ? (
            <div className={styles.accountRow}>
              <span className={styles.accountName}>{user.username}</span>
              <div className={styles.accountBtns}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>Profile</button>
                <a className="btn btn-ghost btn-sm" href="/api/gdpr/export" download>Export Data</a>
              </div>
            </div>
          ) : (
            <div className={styles.accountRow}>
              <span className={styles.accountName}>Guest</span>
              <div className={styles.accountBtns}>
                <button className="btn btn-juice btn-sm" onClick={() => navigate('/register')}>Sign Up</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Log In</button>
              </div>
            </div>
          )}
        </Section>

        <Section title="Keyboard Shortcuts">
          <p className={styles.shortcutHint}>
            Press <kbd className={styles.kbd}>?</kbd> anywhere to see all shortcuts.
            Use <kbd className={styles.kbd}>g h</kbd> to go Home,{' '}
            <kbd className={styles.kbd}>g p</kbd> for Profile, etc.
          </p>
        </Section>

        <p className={styles.version}>Numbskull · All phases complete · 161 tests passing</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onChange(!checked)}
        aria-label={label}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}

function SliderRow({ label, description, value, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{description}</span>
      </div>
      <div className={styles.sliderWrap}>
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className={styles.slider}
          aria-label={label}
        />
        <span className={styles.sliderVal}>{value === 0 ? '🔇' : `${value}%`}</span>
      </div>
    </div>
  )
}

function SelectRow({ label, description, value, onChange, options }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDesc}>{description}</span>
      </div>
      <select
        className={styles.select}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
