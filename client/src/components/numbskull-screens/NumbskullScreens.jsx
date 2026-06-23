// NumbskullScreens.jsx — the six review-feature screens, ported to React.
// Self-contained inline styles. Depends on ./Skull.jsx, ./GameIcon.jsx, ./numbskull.css
//
//   import { MatchHistoryScreen, LevelUpScreen, StreakScreen,
//            SkullCustomizerScreen, DifficultyScreen, MultiplayerTutorialScreen }
//     from './numbskull-screens/NumbskullScreens.jsx'
//
// Each screen fills the viewport (max-width 480, centered) and accepts optional
// callbacks: onBack, onPrimary, onSelect, etc. Wire them to your router.

import './numbskull.css'
import Skull from './Skull.jsx'
import GameIcon from '../icons/GameIcon.jsx'

/* ---- shared bits ------------------------------------------------------- */
const screen = {
  minHeight: '100dvh', maxWidth: 480, margin: '0 auto', position: 'relative',
  background: '#1C1842', color: '#EEEDFE', fontFamily: "'Outfit', sans-serif",
  display: 'flex', flexDirection: 'column',
}
const mono = "'Chakra Petch', monospace"
const cardGrad = 'linear-gradient(150deg,#2c2569,#231e51)'
const cardShadow = 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 12px rgba(0,0,0,0.22)'
const primaryBtn = {
  width: '100%', minHeight: 52, borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg,#33F7FF,#00F5FF)', color: '#1C1842',
  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16,
  boxShadow: '0 0 24px rgba(0,245,255,0.4)',
}
function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Back" style={{
      width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)', color: '#AFA9EC', fontSize: 18, cursor: 'pointer',
    }}>‹</button>
  )
}

/* ============================ MATCH HISTORY ============================= */
const HISTORY = [
  { icon: 'gtn', name: 'Guess The Number', sub: 'vs. ByteReaper · 2h ago', win: true, stat: '6 guesses' },
  { icon: 'bc', name: 'Bulls & Cows', sub: 'vs. m1ndgame · 5h ago', win: false, stat: '9 turns' },
  { icon: 'math', name: 'Math Battle', sub: 'vs. quadratic · Yesterday', win: true, stat: '+340 pts' },
  { icon: 'countdown', name: 'Countdown', sub: 'Solo · Yesterday', win: true, stat: '0 off' },
  { icon: 'gtn', name: 'Guess The Number', sub: 'vs. nullptr · 2d ago', win: false, stat: 'timeout' },
]
export function MatchHistoryScreen({ onBack, roastsVisible = true, games = HISTORY }) {
  return (
    <div style={screen}>
      <div style={{ padding: '20px 22px 18px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <BackBtn onClick={onBack} />
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, flex: 1 }}>Match History</h1>
          <button style={{ padding: '8px 14px', borderRadius: 999, background: 'rgba(0,245,255,0.12)', border: '1px solid rgba(0,245,255,0.3)', color: '#00F5FF', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer' }}>All ▾</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[['68%', 'Win rate', '#00F5FF'], ['41–19', 'W · L', '#EEEDFE'], ['7', 'Best run', '#FFD740']].map(([v, l, c]) => (
            <div key={l} style={{ background: cardGrad, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A82B0', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, background: cardGrad, boxShadow: cardShadow, border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${g.win ? '#00E676' : '#FF3E8A'}`, borderRadius: 14, padding: '13px 15px' }}>
              <GameIcon icon={g.icon} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: '#8A82B0' }}>{g.sub}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: g.win ? '#00E676' : '#FF3E8A', letterSpacing: '0.05em' }}>{g.win ? 'WIN' : 'LOSS'}</div>
                <div style={{ fontFamily: mono, fontSize: 13, color: '#AFA9EC' }}>{g.stat}</div>
              </div>
            </div>
          ))}
        </div>
        {roastsVisible && (
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,62,138,0.07)', border: '1px solid rgba(255,62,138,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <Skull expression="judging" size={34} glow={false} />
            <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: '#AFA9EC', lineHeight: 1.4 }}>“41 wins. Cute. The other 19 still keep me warm at night.”</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================== LEVEL UP =============================== */
export function LevelUpScreen({ level = 12, rank = 'Cipher', xp = 320, xpMax = 500, onPrimary }) {
  const pct = Math.min(100, Math.round((xp / xpMax) * 100))
  const confetti = [[60, 120, '#00F5FF', 2.6, 0], [300, 100, '#FF3E8A', 2.9, 0.4], [120, 90, '#FFD740', 3.1, 0.8], [250, 150, '#00E676', 2.7, 1.1]]
  return (
    <div style={{ ...screen, background: 'radial-gradient(120% 60% at 50% 8%, #2a2270 0%, #1C1842 55%)' }}>
      {confetti.map(([l, t, c, d, delay], i) => (
        <span key={i} style={{ position: 'absolute', left: l, top: t, width: 8, height: 8, background: c, borderRadius: 2, animation: `ns-confetti ${d}s ease-in ${delay}s infinite` }} />
      ))}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 28px 28px', textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#00F5FF', marginBottom: 4 }}>Level Up</div>
        <div className="ns-float" style={{ position: 'relative', margin: '18px 0 6px', padding: 16, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,245,255,0.22), transparent 72%)' }}>
          <Skull expression="impressed" size={150} />
        </div>
        <div style={{ fontWeight: 900, fontSize: 48, lineHeight: 1, letterSpacing: '-0.03em' }}>{level}</div>
        <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AFA9EC', marginTop: 6 }}>Rank: <span style={{ color: '#00F5FF' }}>{rank}</span></div>
        <div style={{ width: '100%', marginTop: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 12, color: '#8A82B0', marginBottom: 8 }}>
            <span style={{ color: '#AFA9EC' }}>{xp} / {xpMax} XP</span><span>{xpMax - xp} to Lvl {level + 1}</span>
          </div>
          <div style={{ height: 16, borderRadius: 999, background: '#26215C', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
            <div className="ns-xpbar" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(90deg,#00F5FF,#534AB7)', boxShadow: '0 0 16px rgba(0,245,255,0.5)' }} />
          </div>
        </div>
        <div style={{ width: '100%', marginTop: 26, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[['Match won', '+50 XP', '#00E676'], ['Speed bonus · solved in 6', '+20 XP', '#00F5FF'], ['Streak multiplier', '×1.5', '#FFD740']].map(([l, v, c]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#26215C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '11px 15px' }}>
              <span style={{ fontSize: 13, color: '#AFA9EC' }}>{l}</span>
              <span style={{ fontFamily: mono, fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onPrimary} style={{ ...primaryBtn, marginTop: 'auto' }}>Claim &amp; continue</button>
      </div>
    </div>
  )
}

/* ============================ DAILY STREAK ============================= */
export function StreakScreen({ onBack, streak = 14, roastsVisible = true, onPrimary }) {
  const week = [['M', 'done'], ['T', 'done'], ['W', 'done'], ['T', 'today'], ['F', 'future'], ['S', 'future'], ['S', 'future']]
  const dot = (state) => {
    if (state === 'done') return { background: '#00E676', color: '#1C1842', content: '✓', fw: 800, fs: 15, border: 'none', shadow: 'none' }
    if (state === 'today') return { background: '#1C1842', color: '#00F5FF', content: '🔥', fw: 400, fs: 18, border: '2px solid #00F5FF', shadow: '0 0 14px rgba(0,245,255,0.4)' }
    return { background: '#26215C', color: '#4A4466', content: '·', fw: 400, fs: 13, border: '1px solid rgba(255,255,255,0.08)', shadow: 'none' }
  }
  return (
    <div style={screen}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <BackBtn onClick={onBack} />
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Daily Streak</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'radial-gradient(90% 80% at 50% 10%, rgba(255,140,40,0.16), transparent 70%)', padding: '14px 0 22px' }}>
          <div className="ns-flame" style={{ fontSize: 78, lineHeight: 1, filter: 'drop-shadow(0 0 22px rgba(255,150,40,0.55))' }}>🔥</div>
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 64, lineHeight: 1, marginTop: 6, background: 'linear-gradient(180deg,#FFD740,#FF8A3D)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{streak}</div>
          <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#AFA9EC', marginTop: 4 }}>Day Streak</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, margin: '22px 0 8px' }}>
          {week.map(([d, state], i) => {
            const s = dot(state)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ fontSize: 11, color: '#8A82B0', fontFamily: mono }}>{d}</div>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: s.background, color: s.color, border: s.border, boxShadow: s.shadow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: s.fw, fontSize: s.fs }}>{s.content}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#26215C', border: '1px solid rgba(0,245,255,0.18)', borderRadius: 16, padding: '14px 16px', marginTop: 18 }}>
          <GameIcon icon="shield" size={46} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>Streak Freeze</div><div style={{ fontSize: 12, color: '#8A82B0' }}>Miss a day, keep the flame. 1 left this week.</div></div>
          <span style={{ fontFamily: mono, fontWeight: 700, color: '#00F5FF', fontSize: 18 }}>1</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#26215C,#312A72)', border: '1px solid rgba(255,215,64,0.2)', borderRadius: 16, padding: '14px 16px', marginTop: 12 }}>
          <GameIcon icon="medal" size={46} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>Day 30 reward</div><div style={{ fontSize: 12, color: '#8A82B0' }}>“Inferno” skull skin + 2× XP weekend</div></div>
          <span style={{ fontFamily: mono, color: '#AFA9EC', fontSize: 13 }}>16d</span>
        </div>
        {roastsVisible && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <Skull expression="evil" size={38} glow={false} />
            <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: '#AFA9EC', lineHeight: 1.4 }}>“14 days straight. Break it and I tell everyone.”</p>
          </div>
        )}
        <button onClick={onPrimary} style={{ ...primaryBtn, marginTop: 'auto' }}>Play today's challenge</button>
      </div>
    </div>
  )
}

/* ========================= SKULL CUSTOMIZER =========================== */
const SKINS = [
  { filter: 'hue-rotate(0deg)' },
  { filter: 'hue-rotate(95deg) saturate(1.3)', selected: true },
  { filter: 'hue-rotate(190deg) saturate(1.6)' },
  { filter: 'hue-rotate(280deg) saturate(1.2)' },
  { filter: 'sepia(0.7) saturate(2) hue-rotate(5deg)' },
  { filter: 'grayscale(0.6)', locked: true },
  { filter: 'grayscale(0.6) hue-rotate(150deg)', locked: true },
  { filter: 'grayscale(1) brightness(1.3)', locked: true },
]
export function SkullCustomizerScreen({ onBack, onPrimary }) {
  const moods = [['Neutral', false], ['Judging', false], ['Evil', true], ['Smug', false]]
  return (
    <div style={screen}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <BackBtn onClick={onBack} />
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Your Skull</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0 14px' }}>
          <div className="ns-float" style={{ filter: 'hue-rotate(95deg) saturate(1.3)' }}><Skull expression="evil" size={128} /></div>
          <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00F5FF', marginTop: 8 }}>Toxic</div>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A82B0', margin: '6px 0 12px' }}>Skins</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {SKINS.map((s, i) => (
            <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 16, background: s.locked ? '#221d4f' : '#26215C', border: s.selected ? '2px solid #00F5FF' : '1px solid rgba(255,255,255,0.08)', boxShadow: s.selected ? '0 0 16px rgba(0,245,255,0.35)' : 'none', opacity: s.locked ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ filter: s.filter }}><Skull expression="neutral" size={50} glow={false} /></div>
              {s.locked && <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 13 }}>🔒</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A82B0', margin: '20px 0 12px' }}>Mood</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {moods.map(([m, active]) => (
            <button key={m} style={{ flex: 1, padding: '10px 0', borderRadius: 12, background: active ? 'rgba(0,245,255,0.12)' : '#26215C', border: active ? '1px solid #00F5FF' : '1px solid rgba(255,255,255,0.08)', color: active ? '#00F5FF' : '#AFA9EC', fontSize: 12, fontWeight: active ? 700 : 600, cursor: 'pointer' }}>{m}</button>
          ))}
        </div>
        <button onClick={onPrimary} style={{ ...primaryBtn, marginTop: 'auto' }}>Equip skull</button>
      </div>
    </div>
  )
}

/* =========================== DIFFICULTY =============================== */
const DIFFS = [
  { icon: 'sprout', name: 'EASY', color: '#00E676', desc: "Warm-up. I'll go easy. Once.", range: '1 – 100', tries: '~7 tries' },
  { icon: 'gtn', name: 'MEDIUM', color: '#FFD740', desc: 'The honest test. Most players live here.', range: '1 – 1000', tries: '~10 tries' },
  { icon: 'skull', name: 'HARD', color: '#FF3E8A', desc: 'Bring a notepad. And tissues.', range: '1 – 10000', tries: '~14 tries' },
]
export function DifficultyScreen({ onBack, onPrimary, onSelect, game = 'Guess The Number' }) {
  return (
    <div style={screen}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <BackBtn onClick={onBack} />
          <div><h1 style={{ fontSize: 21, lineHeight: 1.1, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap' }}>Choose Your Pain</h1><p style={{ margin: '3px 0 0', fontSize: 13, color: '#8A82B0' }}>{game} · Solo</p></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 18px' }}><Skull expression="judging" size={96} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DIFFS.map((d) => (
            <button key={d.name} onClick={() => onSelect?.(d.name)} style={{ display: 'flex', alignItems: 'center', gap: 15, textAlign: 'left', width: '100%', padding: '15px 18px', background: 'linear-gradient(150deg,#2d2670,#241f55)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `4px solid ${d.color}`, borderRadius: 16, cursor: 'pointer' }}>
              <GameIcon icon={d.icon} size={44} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: mono, fontWeight: 700, fontSize: 17, color: d.color }}>{d.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#8A82B0', marginTop: 2 }}>{d.desc}</span>
              </span>
              <span style={{ flex: 'none', textAlign: 'right', fontFamily: mono }}>
                <span style={{ display: 'block', fontSize: 14, color: '#AFA9EC', whiteSpace: 'nowrap' }}>{d.range}</span>
                <span style={{ display: 'block', fontSize: 11, color: '#8A82B0' }}>{d.tries}</span>
              </span>
            </button>
          ))}
          <button onClick={() => onSelect?.('ADAPTIVE')} style={{ display: 'flex', alignItems: 'center', gap: 15, textAlign: 'left', width: '100%', padding: '15px 18px', background: 'linear-gradient(135deg,rgba(0,245,255,0.08),#26215C)', border: '1px solid rgba(0,245,255,0.3)', borderLeft: '4px solid #00F5FF', borderRadius: 16, cursor: 'pointer' }}>
            <GameIcon icon="chip" size={44} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: mono, fontWeight: 700, fontSize: 17, color: '#00F5FF' }}>ADAPTIVE</span>
              <span style={{ display: 'block', fontSize: 12, color: '#8A82B0', marginTop: 2 }}>Ramps to your skill. No mercy, no boredom.</span>
            </span>
            <span style={{ flex: 'none', fontFamily: mono, fontSize: 11, fontWeight: 700, color: '#00F5FF', textTransform: 'uppercase' }}>★ Smart</span>
          </button>
        </div>
        <button onClick={onPrimary} style={{ ...primaryBtn, marginTop: 'auto' }}>Start · Medium</button>
      </div>
    </div>
  )
}

/* ======================= MULTIPLAYER TUTORIAL ========================= */
export function MultiplayerTutorialScreen({ step = 2, total = 4, onSkip, onNext }) {
  return (
    <div style={{ ...screen, overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, padding: '18px 22px', opacity: 0.32, filter: 'blur(0.4px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><span style={{ fontFamily: mono, color: '#00F5FF', fontWeight: 700 }}>Room · 7F2K9</span><span style={{ fontFamily: mono, color: '#AFA9EC', fontSize: 13 }}>0:45</span></div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, background: '#26215C', borderRadius: 14, padding: 14, textAlign: 'center' }}><div style={{ fontWeight: 700 }}>You</div><div style={{ fontSize: 12, color: '#8A82B0' }}>setting…</div></div>
            <div style={{ flex: 1, background: '#26215C', borderRadius: 14, padding: 14, textAlign: 'center' }}><div style={{ fontWeight: 700 }}>ByteReaper</div><div style={{ fontSize: 12, color: '#00E676' }}>ready ✓</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ aspectRatio: '1', background: '#312A72', borderRadius: 12 }} />)}</div>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,11,30,0.82)' }} />
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 120, background: '#26215C', border: '1px solid rgba(0,245,255,0.25)', borderRadius: 22, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} style={{ width: 26, height: 6, borderRadius: 3, background: i < step ? '#00F5FF' : '#3D3589' }} />
            ))}
            <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 12, color: '#8A82B0' }}>Step {step} of {total}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flex: 'none' }}><Skull expression="neutral" size={56} /></div>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Set your secret number</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#AFA9EC', lineHeight: 1.5 }}>Pick a number only you know. Your opponent will try to crack it — and you'll crack theirs. Lowest guesses wins.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
            <button onClick={onSkip} style={{ background: 'none', border: 'none', color: '#8A82B0', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '8px 4px' }}>Skip tour</button>
            <button onClick={onNext} style={{ marginLeft: 'auto', minHeight: 46, padding: '0 26px', borderRadius: 999, background: 'linear-gradient(135deg,#33F7FF,#00F5FF)', color: '#1C1842', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, border: 'none', boxShadow: '0 0 20px rgba(0,245,255,0.4)', cursor: 'pointer' }}>Got it →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
