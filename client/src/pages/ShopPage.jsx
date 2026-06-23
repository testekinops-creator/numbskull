import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { api } from '../services/api.js'
import Avatar from '../components/avatar/Avatar.jsx'
import AmbientOrbs from '../components/AmbientOrbs.jsx'
import { CoinIcon } from '../components/icons/Icons.jsx'
import styles from './ShopPage.module.css'

// Best-effort weekly-quest progress from the locally-tracked badge stats
// (server validates completion + idempotency on claim).
const STATS_KEY = 'ns_badge_stats'
function loadStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {} } catch { return {} } }
function questProgress(q, s) {
  if (q.type === 'wins' && q.mode === 'GTN') return s.gtnWins || 0
  if (q.type === 'wins' && q.mode === 'BC')  return s.bcWins || 0
  if (q.type === 'multi') return s.multiWins || 0
  if (q.type === 'play')  return s.totalGames || 0
  return 0   // optimal / speed / daily / win — not tracked client-side
}

export default function ShopPage() {
  const navigate = useNavigate()
  const { isRegistered, user, updateUser } = useAuth()
  const [shop, setShop]     = useState(null)   // { catalog, owned, equipped, coins, level }
  const [quests, setQuests] = useState([])
  const [busy, setBusy]     = useState('')
  const [msg, setMsg]       = useState('')

  const load = useCallback(async () => {
    try { setShop(await api.get('/shop')) } catch { /* keep prev */ }
    try { const q = await api.get('/quests'); setQuests(q.quests || []) } catch { /* ignore */ }
  }, [])
  useEffect(() => { if (isRegistered) load() }, [isRegistered, load])

  async function buy(id) {
    setBusy(id); setMsg('')
    try { const d = await api.post('/shop/buy', { id }); updateUser(d.user); await load(); setMsg('Purchased!') }
    catch (e) { setMsg(e.message || 'Could not buy') } finally { setBusy('') }
  }
  async function equip(type, apiId, busyKey) {
    setBusy(busyKey ?? apiId); setMsg('')
    try { const d = await api.post('/shop/equip', { type, id: apiId }); updateUser(d.user); await load() }
    catch (e) { setMsg(e.message || 'Could not equip') } finally { setBusy('') }
  }
  async function claim(q) {
    setBusy(q.id); setMsg('')
    try {
      const d = await api.post('/quests/claim', { questId: q.id, progress: questProgress(q, loadStats()) })
      if (d.claimed) { updateUser(d.user); setMsg(`Claimed +${d.xp} XP, +${d.coins} coins!`) }
      else if (d.already) setMsg('Already claimed this week.')
      else setMsg('Not done yet — keep playing!')
      await load()
    } catch (e) { setMsg(e.message || 'Could not claim') } finally { setBusy('') }
  }

  if (!isRegistered) {
    return (
      <div className="screen">
        <AmbientOrbs />
        <div className={styles.page}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ alignSelf: 'flex-start' }}>← Back</button>
          <p className={styles.guest}><a href="/register">Create an account</a> to earn XP &amp; coins and unlock cosmetics.</p>
        </div>
      </div>
    )
  }

  const ownedSet = new Set(shop?.owned || [])
  const frames = (shop?.catalog || []).filter(c => c.type === 'frame')
  const titles = (shop?.catalog || []).filter(c => c.type === 'title')

  return (
    <div className="screen">
      <AmbientOrbs />
      <div className={styles.page}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/profile')}>← Profile</button>
          <h1 className={styles.title}>Shop</h1>
          <span className={styles.coins} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CoinIcon size={16} /> {shop?.coins ?? 0}</span>
        </div>
        {shop && <p className={styles.levelLine}>Level {shop.level}</p>}
        {msg && <div className={styles.msg}>{msg}</div>}
        {!shop && <p className={styles.loading}>Loading…</p>}

        {quests.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Weekly Quests</h2>
            <div className={styles.questList}>
              {quests.map(q => {
                const prog = questProgress(q, loadStats())
                const done = prog >= q.goal
                return (
                  <div key={q.id} className={styles.quest}>
                    <div className={styles.questInfo}>
                      <span className={styles.questTitle}>{q.title}</span>
                      <span className={styles.questMeta}>{Math.min(prog, q.goal)}/{q.goal} · +{q.xp} XP</span>
                    </div>
                    <button className="btn btn-juice btn-sm" disabled={!done || busy === q.id} onClick={() => claim(q)}>
                      {done ? 'Claim' : '…'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {shop && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Avatar Frames</h2>
            <div className={styles.grid}>
              <CosmeticCard
                preview={<Avatar seed={user?.id} name="Default" size={56} ring="cyan" />}
                name="Default" sub="Free"
                equipped={shop.equipped.frame == null}
                onAction={() => equip('frame', 'default', 'default-frame')}
                disabled={busy === 'default-frame'}
              />
              {frames.map(c => {
                const owned = ownedSet.has(c.id)
                const equipped = shop.equipped.frame === c.value
                const locked = shop.level < c.minLevel
                return (
                  <CosmeticCard key={c.id}
                    preview={<Avatar seed={user?.id} name={c.name} size={56} ring={c.value} />}
                    name={c.name}
                    sub={equipped ? 'Equipped' : owned ? 'Owned' : locked ? `Locked · Lv ${c.minLevel}` : `${c.cost} coins`}
                    equipped={equipped} owned={owned}
                    disabled={busy === c.id || (!owned && (locked || (shop.coins < c.cost)))}
                    onAction={() => (owned ? equip('frame', c.id) : buy(c.id))}
                  />
                )
              })}
            </div>
          </section>
        )}

        {shop && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Titles</h2>
            <div className={styles.grid}>
              <CosmeticCard
                preview={<span className={styles.titlePreview}>—</span>}
                name="None" sub="Free"
                equipped={shop.equipped.title == null}
                onAction={() => equip('title', 'default', 'default-title')}
                disabled={busy === 'default-title'}
              />
              {titles.map(c => {
                const owned = ownedSet.has(c.id) || c.cost === 0
                const equipped = shop.equipped.title === c.value
                const locked = shop.level < c.minLevel
                return (
                  <CosmeticCard key={c.id}
                    preview={<span className={styles.titlePreview}>{c.value}</span>}
                    name={c.name}
                    sub={equipped ? 'Equipped' : owned ? 'Owned' : locked ? `Locked · Lv ${c.minLevel}` : `${c.cost} coins`}
                    equipped={equipped} owned={owned}
                    disabled={busy === c.id || (!owned && (locked || (shop.coins < c.cost)))}
                    onAction={() => (owned ? equip('title', c.id) : buy(c.id))}
                  />
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function CosmeticCard({ preview, name, sub, equipped, owned, onAction, disabled }) {
  const label = equipped ? 'Equipped' : owned ? 'Equip' : 'Buy'
  return (
    <div className={`${styles.card} ${equipped ? styles.cardEquipped : ''}`}>
      <div className={styles.preview}>{preview}</div>
      <span className={styles.cardName}>{name}</span>
      <span className={styles.cardSub}>{sub}</span>
      <button
        className={`btn btn-sm ${equipped ? 'btn-ghost' : 'btn-juice'} ${styles.cardBtn}`}
        disabled={disabled || equipped}
        onClick={onAction}
      >
        {label}
      </button>
    </div>
  )
}
