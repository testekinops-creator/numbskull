import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import styles from './AdminPage.module.css'

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, isRegistered } = useAuth()
  const [stats, setStats] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [msgDraft, setMsgDraft] = useState('')
  const [msgType, setMsgType] = useState('info')
  const [banId, setBanId] = useState('')
  const [feedback, setFeedback] = useState('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    api.get('/admin/stats').then(d => setStats(d)).catch(() => {})
    api.get('/admin/announcements').then(d => setAnnouncements(d.announcements)).catch(() => {})
  }, [isAdmin])

  if (!isRegistered || !isAdmin) {
    return (
      <div className="screen">
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <p className={styles.denied}>Access denied. Admins only.</p>
        </div>
      </div>
    )
  }

  async function postAnnouncement(e) {
    e.preventDefault()
    if (!msgDraft.trim()) return
    const data = await api.post('/admin/announcements', { message: msgDraft, type: msgType })
    setAnnouncements(a => [data, ...a])
    setMsgDraft('')
    setFeedback('Announcement posted.')
    setTimeout(() => setFeedback(''), 3000)
  }

  async function deleteAnnouncement(id) {
    await api.del(`/admin/announcements/${id}`)
    setAnnouncements(a => a.filter(x => x.id !== id))
  }

  async function handleBan(unban = false) {
    if (!banId.trim()) return
    const endpoint = unban ? `/admin/users/${banId}/unban` : `/admin/users/${banId}/ban`
    await api.post(endpoint, {})
    setFeedback(unban ? `User ${banId} unbanned.` : `User ${banId} banned.`)
    setBanId('')
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <h1 className={styles.title}>Admin Panel</h1>
          <span className={`badge badge-pink`}>Admin</span>
        </div>

        {feedback && <p className={styles.feedback}>{feedback}</p>}

        {/* Server stats */}
        {stats && (
          <div className={`card ${styles.statsCard}`}>
            <h2 className={styles.sectionTitle}>Server Status</h2>
            <div className={styles.statsGrid}>
              <Stat label="Active Rooms"   value={stats.activeRooms} />
              <Stat label="Playing Rooms"  value={stats.playingRooms} />
              <Stat label="Uptime"         value={`${Math.floor(stats.uptime / 60)}m`} />
              <Stat label="Heap"           value={`${stats.memoryMB}MB`} />
              <Stat label="Node"           value={stats.nodeVersion} mono />
            </div>
          </div>
        )}

        {/* Announcements */}
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Announcements</h2>
          <form className={styles.annForm} onSubmit={postAnnouncement}>
            <textarea
              className={styles.textarea}
              placeholder="System announcement…"
              value={msgDraft}
              onChange={e => setMsgDraft(e.target.value)}
              maxLength={280}
              rows={3}
            />
            <div className={styles.annRow}>
              <select className={styles.select} value={msgType} onChange={e => setMsgType(e.target.value)}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button type="submit" className="btn btn-juice btn-sm">Post</button>
            </div>
          </form>
          <ul className={styles.annList}>
            {announcements.length === 0 && <p className={styles.empty}>No active announcements.</p>}
            {announcements.map(a => (
              <li key={a.id} className={styles.annItem}>
                <span className={`badge ${a.type === 'warning' ? 'badge-pink' : 'badge-juice'}`}>{a.type}</span>
                <span className={styles.annMsg}>{a.message}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteAnnouncement(a.id)}>✕</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Ban/unban */}
        <div className={`card ${styles.section}`}>
          <h2 className={styles.sectionTitle}>Ban / Unban User</h2>
          <div className={styles.banRow}>
            <input
              className="input"
              placeholder="User ID"
              value={banId}
              onChange={e => setBanId(e.target.value)}
              style={{ textAlign: 'left', fontSize: '0.875rem' }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => handleBan(false)}>Ban</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleBan(true)}>Unban</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-brand)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>{value}</span>
    </div>
  )
}
