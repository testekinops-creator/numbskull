import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setColorblindMode } from '../components/AppShell.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import { setSoundVolume } from '../hooks/useSound.js'
import AboutModal from '../components/AboutModal.jsx'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import { enablePushNotifications, disablePushNotifications } from '../services/pwa.js'
import { VERSION_LINE, BUILD_DATE, COMMIT_MSG } from '../utils/buildInfo.js'
import {
  UserIcon, ExitIcon, SpeakerIcon, SpeakerOffIcon, GamepadIcon, BellIcon,
  AccessibilityIcon, ChatIcon, MailIcon, AlertIcon, InfoIcon, SparkleIcon, CheckIcon,
} from '../components/icons/Icons.jsx'
import styles from './SettingsPage.module.css'

const CB_KEY      = 'ns_colorblind_mode'
const SOUND_KEY   = 'ns_sound_enabled'
const VOLUME_KEY  = 'ns_sound_volume'
const HAPTIC_KEY  = 'ns_haptic_enabled'
const MOTION_KEY  = 'ns_reduced_motion'
const PERF_KEY    = 'ns_performance_mode'
const PUSH_KEY    = 'ns_push_enabled'
const ALLOW_WATCH_KEY = 'ns_allow_watch'

const SUPPORT_EMAIL = 'supportnumbskull@gmail.com'

const PUSH_REASON = {
  unsupported:        'Notifications need the installed app or an HTTPS device.',
  'not-configured':   'Notifications aren’t switched on for this build yet.',
  denied:             'Blocked — allow notifications for this site in your browser.',
  'subscribe-failed': 'Couldn’t subscribe — try again.',
  server:             'Couldn’t save your subscription — try again.',
}

function getBool(key, def = true) {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

export default function SettingsPage() {
  const navigate  = useNavigate()
  const { isRegistered, user, logout } = useAuth()
  const { playerId } = usePlayer()
  const { socket } = useSocket()

  const [cbMode, setCbMode] = useState(() => localStorage.getItem(CB_KEY) || 'none')
  const [volume, setVolume] = useState(() => {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw !== null) return Math.max(0, Math.min(100, parseInt(raw, 10) || 0))
    return getBool(SOUND_KEY, true) ? 80 : 0   // migrate from the old on/off toggle
  })
  const [haptic, setHaptic] = useState(() => getBool(HAPTIC_KEY, true))
  const [motion, setMotion] = useState(() => getBool(MOTION_KEY, false))
  const [perf,   setPerf]   = useState(() => getBool(PERF_KEY, false))
  const [allowWatch, setAllowWatch] = useState(() => getBool(ALLOW_WATCH_KEY, true))
  const [copied, setCopied] = useState(false)

  // "Let friends watch my games" — persist + tell the server live (no reconnect).
  useEffect(() => {
    localStorage.setItem(ALLOW_WATCH_KEY, String(allowWatch))
    socket?.emit('presence:watchable', { allowWatch })
  }, [allowWatch, socket])

  // Push notifications: reflect the real granted+subscribed state on mount.
  const [pushOn, setPushOn]   = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  useEffect(() => {
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    setPushOn(granted && localStorage.getItem(PUSH_KEY) === 'true')
  }, [])

  async function togglePush(on) {
    setPushBusy(true); setPushMsg('')
    if (on) {
      const r = await enablePushNotifications()
      if (r.ok) { setPushOn(true); localStorage.setItem(PUSH_KEY, 'true') }
      else { setPushOn(false); setPushMsg(PUSH_REASON[r.reason] || 'Could not enable notifications.') }
    } else {
      await disablePushNotifications()
      setPushOn(false); localStorage.setItem(PUSH_KEY, 'false')
    }
    setPushBusy(false)
  }

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
    const root = document.documentElement.style
    if (motion) {
      root.setProperty('--duration-fast',   '0.01ms')
      root.setProperty('--duration-normal', '0.01ms')
      root.setProperty('--duration-slow',   '0.01ms')
    } else {
      root.removeProperty('--duration-fast')
      root.removeProperty('--duration-normal')
      root.removeProperty('--duration-slow')
    }
  }, [motion])

  // Performance mode → flag heavy background effects (e.g. the Matrix rain) to skip.
  useEffect(() => {
    localStorage.setItem(PERF_KEY, String(perf))
    if (perf) document.documentElement.dataset.perf = '1'
    else delete document.documentElement.dataset.perf
  }, [perf])

  const [aboutOpen, setAboutOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  // Registered users get their account id; guests get their guest playerId.
  const accountId = (isRegistered && user?.id) ? user.id : playerId

  function copyId() {
    navigator.clipboard?.writeText(accountId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const shortId = accountId ? `${String(accountId).slice(0, 14)}…` : '—'

  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={styles.page}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h1 className={styles.title}>Settings</h1>
        </div>

        {/* ── Account ── */}
        <Section icon={<UserIcon size={18} />} title="Account">
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>{isRegistered ? user.username : 'Guest'}</span>
              <span className={styles.rowDesc}>
                {isRegistered ? 'Signed in' : 'Playing as guest — sign up to save your progress.'}
              </span>
            </div>
            <div className={styles.accountBtns}>
              {isRegistered ? (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>Profile</button>
              ) : (
                <>
                  <button className="btn btn-juice btn-sm" onClick={() => navigate('/register')}>Sign Up</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Log In</button>
                </>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>Player ID</span>
              <span className={styles.rowDesc}><code className={styles.idCode}>{shortId}</code></span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={copyId}>{copied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckIcon size={14} /> Copied</span> : 'Copy'}</button>
          </div>

          {isRegistered && (
            <ButtonRow icon={<ExitIcon size={18} />} label="Log Out" danger onClick={handleLogout} />
          )}
        </Section>

        {/* ── Audio ── */}
        <Section icon={<SpeakerIcon size={18} />} title="Audio">
          <SliderRow
            label="Sound Volume"
            description="Musical pitch feedback on guesses. 0 = muted."
            value={volume}
            onChange={setVolume}
          />
        </Section>

        {/* ── Gameplay ── */}
        <Section icon={<GamepadIcon size={18} />} title="Gameplay">
          <ToggleRow
            label="Haptic Feedback"
            description="Vibration patterns on mobile devices."
            checked={haptic}
            onChange={setHaptic}
          />
          <ToggleRow
            label="Reduced Motion"
            description="Minimise animations and transitions."
            checked={motion}
            onChange={setMotion}
          />
          <ToggleRow
            label="Performance Mode"
            description="Turn off heavy background effects for smoother play on older devices."
            checked={perf}
            onChange={setPerf}
          />
          <ToggleRow
            label="Let friends watch my games"
            description="Friends can spectate your live matches in real time."
            checked={allowWatch}
            onChange={setAllowWatch}
          />
        </Section>

        {/* ── Notifications (registered users — needs a persistent account) ── */}
        {isRegistered && (
          <Section icon={<BellIcon size={18} />} title="Notifications">
            <ToggleRow
              label={pushBusy ? 'Working…' : 'Daily game reminder'}
              description={pushMsg || 'A once-a-day nudge to play your most-played game.'}
              checked={pushOn}
              onChange={togglePush}
            />
          </Section>
        )}

        {/* ── Accessibility ── */}
        <Section icon={<AccessibilityIcon size={18} />} title="Accessibility">
          <SelectRow
            label="Colorblind Mode"
            description="Adjusts accent colours for colour-vision deficiencies."
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

        {/* ── Support ── */}
        <Section icon={<ChatIcon size={18} />} title="Support">
          <LinkRow icon={<MailIcon size={18} />} label="Contact Support" href={`mailto:${SUPPORT_EMAIL}`} external />
          <LinkRow icon={<AlertIcon size={18} />} label="Report a Problem" href={`mailto:${SUPPORT_EMAIL}?subject=Numbskull%20bug%20report`} external />
        </Section>

        {/* ── About ── */}
        <Section icon={<InfoIcon size={18} />} title="About">
          <ButtonRow icon={<InfoIcon size={18} />} label="About Numbskull" onClick={() => setAboutOpen(true)} />
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <span className={styles.rowLabel}>Version</span>
              <span className={styles.rowDesc}>
                {VERSION_LINE}{BUILD_DATE ? ` · ${BUILD_DATE}` : ''}
                {COMMIT_MSG ? <><br /><span className={styles.whatsNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SparkleIcon size={13} /> {COMMIT_MSG}</span></> : null}
              </span>
            </div>
          </div>
        </Section>

        <p className={styles.version}>Numbskull · {VERSION_LINE}</p>
      </div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

/* ── Building blocks ─────────────────────────────────────────────── */
function Section({ icon, title, children }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>{icon}</span>
        {title}
      </h2>
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
          style={{ '--fill': `${value}%` }}
          aria-label={label}
        />
        <span className={styles.sliderVal}>{value === 0 ? <SpeakerOffIcon size={14} /> : `${value}%`}</span>
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

function LinkRow({ icon, label, href, download, external }) {
  return (
    <a
      className={styles.linkRow}
      href={href}
      {...(download ? { download: true } : {})}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className={styles.linkIcon}>{icon}</span>
      <span className={styles.linkLabel}>{label}</span>
      <span className={styles.linkChevron}>›</span>
    </a>
  )
}

function ButtonRow({ icon, label, onClick, danger }) {
  return (
    <button className={`${styles.linkRow} ${danger ? styles.dangerRow : ''}`} onClick={onClick}>
      <span className={styles.linkIcon}>{icon}</span>
      <span className={styles.linkLabel}>{label}</span>
      <span className={styles.linkChevron}>›</span>
    </button>
  )
}
