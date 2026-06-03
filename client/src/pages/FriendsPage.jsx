import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import styles from './FriendsPage.module.css'

export default function FriendsPage() {
  const navigate = useNavigate()
  const { isRegistered } = useAuth()

  const [tab,       setTab]       = useState('friends') // friends | requests | add
  const [friends,   setFriends]   = useState([])
  const [requests,  setRequests]  = useState([])
  const [search,    setSearch]    = useState('')
  const [results,   setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [sent,      setSent]      = useState(new Set())

  useEffect(() => {
    if (!isRegistered) return
    api.get('/users/me/friends').then(d => setFriends(d.friends || [])).catch(() => {})
    api.get('/users/me/friend-requests').then(d => setRequests(d.requests || [])).catch(() => {})
  }, [isRegistered])

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const data = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}`)
      setResults(data.users || [])
    } catch { setResults([]) }
    finally  { setSearching(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 350)
    return () => clearTimeout(t)
  }, [search, doSearch])

  async function sendRequest(id) {
    await api.post(`/users/${id}/friend`, {})
    setSent(s => new Set([...s, id]))
  }

  async function accept(id) {
    await api.post(`/users/${id}/friend/accept`, {})
    setRequests(r => r.filter(u => u.id !== id))
    api.get('/users/me/friends').then(d => setFriends(d.friends || [])).catch(() => {})
  }

  async function decline(id) {
    await api.post(`/users/${id}/friend/decline`, {})
    setRequests(r => r.filter(u => u.id !== id))
  }

  async function remove(id) {
    await api.del(`/users/${id}/friend`)
    setFriends(f => f.filter(u => u.id !== id))
  }

  if (!isRegistered) {
    return (
      <div className="screen">
        <div className={`panel ${styles.page}`}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
          <p className={styles.guestMsg}>
            <a href="/register">Create an account</a> to add friends and challenge them.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className={`panel ${styles.page}`}>
        {/* Header */}
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>← Profile</button>
          <h1 className={styles.title}>Friends</h1>
          {requests.length > 0 && <span className={`badge badge-pink`}>{requests.length}</span>}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            ['friends',  `Friends (${friends.length})`],
            ['requests', `Requests (${requests.length})`],
            ['add',      '+ Add Friend'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`${styles.tab} ${tab === id ? styles.active : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Friends list ── */}
        {tab === 'friends' && (
          <ul className={styles.list}>
            {friends.length === 0 && (
              <div className={styles.empty}>
                <p>No friends yet.</p>
                <button className="btn btn-juice btn-sm" onClick={() => setTab('add')}>
                  + Add someone
                </button>
              </div>
            )}
            {friends.map(f => (
              <li key={f.id} className={`${styles.item} card`}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{f.username}</span>
                  <span className={styles.itemStat}>{f.totalGames ?? 0} games</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(f.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Friend requests ── */}
        {tab === 'requests' && (
          <ul className={styles.list}>
            {requests.length === 0 && <p className={styles.emptyText}>No pending requests.</p>}
            {requests.map(r => (
              <li key={r.id} className={`${styles.item} card`}>
                <span className={styles.itemName}>{r.username}</span>
                <div className={styles.itemActions}>
                  <button className="btn btn-juice btn-sm" onClick={() => accept(r.id)}>✓ Accept</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => decline(r.id)}>✗ Decline</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* ── Add friend (search) ── */}
        {tab === 'add' && (
          <div className={styles.addSection}>
            <div className={styles.searchWrap}>
              <input
                className={`input ${styles.searchInput}`}
                type="text"
                placeholder="Search by username…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                aria-label="Search users"
              />
              {searching && <div className={styles.miniSpinner} />}
            </div>

            {search.length > 0 && search.length < 2 && (
              <p className={styles.hint}>Type at least 2 characters</p>
            )}

            {results.length === 0 && search.length >= 2 && !searching && (
              <p className={styles.emptyText}>No users found for "{search}"</p>
            )}

            <ul className={styles.list}>
              {results.map(u => (
                <li key={u.id} className={`${styles.item} card`}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{u.username}</span>
                    <span className={styles.itemStat}>{u.totalGames ?? 0} games</span>
                  </div>
                  {u.isFriend ? (
                    <span className={`badge badge-juice`}>Friends ✓</span>
                  ) : sent.has(u.id) ? (
                    <span className={`badge badge-pink`}>Sent ✓</span>
                  ) : (
                    <button className="btn btn-juice btn-sm" onClick={() => sendRequest(u.id)}>
                      + Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
