// GameIcon.jsx — premium per-game icon for Numbskull
// Drop into: client/src/components/icons/GameIcon.jsx
// Usage:  <GameIcon icon="gtn" size={48} />
// No CSS/token dependency — fully self-contained inline styles.

const ACCENTS = {
  gtn: '#00F5FF', bc: '#FF3E8A', xox: '#00F5FF', math: '#FF3E8A', sudoku: '#00F5FF',
  queens: '#FFD740', tango: '#00F5FF', zip: '#FF3E8A', pinpoint: '#FFD740',
  crossclimb: '#00F5FF', spin: '#FF3E8A', sos: '#00F5FF',
  countdown: '#FFD740', chain: '#00E676', towers: '#2DD4BF',
  sprout: '#00E676', skull: '#FF3E8A', chip: '#00F5FF',
  shield: '#00E676', medal: '#FFD740', flame: '#FF8A3D', lock: '#8A82B0',
}

const L = '#EAF6FF' // light structural stroke

const GLYPHS = {
  gtn: (a) => (<>
    <circle cx="12" cy="12" r="8.4" stroke={L} strokeWidth="1.7" />
    <circle cx="12" cy="12" r="4.5" stroke={L} strokeWidth="1.7" />
    <circle cx="12" cy="12" r="1.8" fill={a} />
    <path d="M12 1.4V4.2 M12 19.8V22.6 M1.4 12H4.2 M19.8 12H22.6" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  bc: (a) => (<>
    <rect x="4.5" y="10.4" width="15" height="10.6" rx="2.6" stroke={L} strokeWidth="1.7" />
    <path d="M7.6 10.4V8a4.4 4.4 0 0 1 8.8 0v2.4" stroke={L} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="14.8" r="1.9" fill={a} />
    <path d="M12 16.3V18.4" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  xox: (a) => (<>
    <path d="M9 4V20 M15 4V20 M4 9H20 M4 15H20" stroke={L} strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />
    <path d="M5 5.4l2.6 2.6 M7.6 5.4L5 8" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.9" stroke={a} strokeWidth="1.8" />
    <path d="M16.4 16l2.6 2.6 M19 16l-2.6 2.6" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
  </>),
  math: (a) => (<>
    <path d="M4.5 19.2L15.5 8.2" stroke={L} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M19.5 19.2L8.5 8.2" stroke={L} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15.5 8.2l2-2 M8.5 8.2l-2-2" stroke={a} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="4.6" cy="19.4" r="1.7" fill={a} />
    <circle cx="19.4" cy="19.4" r="1.7" fill={a} />
  </>),
  sudoku: (a) => (<>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke={L} strokeWidth="1.5" />
    <path d="M9 4V20 M15 4V20 M4 9H20 M4 15H20" stroke={L} strokeWidth="1" opacity="0.55" />
    <circle cx="6" cy="6" r="1.2" fill={a} />
    <circle cx="18" cy="12" r="1.2" fill={a} />
    <circle cx="12" cy="18" r="1.2" fill={a} />
  </>),
  queens: (a) => (<>
    <path d="M4.5 18.5l-1.3-9 4.4 3.2L12 6l4.4 6.7 4.4-3.2-1.3 9z" stroke={L} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M6 18.5h12" stroke={a} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="3.6" cy="9" r="1.1" fill={a} />
    <circle cx="12" cy="5.6" r="1.2" fill={a} />
    <circle cx="20.4" cy="9" r="1.1" fill={a} />
  </>),
  tango: (a) => (<>
    <circle cx="8.4" cy="8.8" r="3.1" fill={a} />
    <path d="M8.4 2.8V4.4 M8.4 13.2v1.6 M2.4 8.8H4 M12.8 8.8h1.6 M4.4 4.8l1.1 1.1 M11.3 11.7l1.1 1.1 M12.4 4.8l-1.1 1.1 M5.5 11.7l-1.1 1.1" stroke={a} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M20.4 15.4a4.4 4.4 0 1 1-4.8-4.4 3.4 3.4 0 0 0 4.8 4.4z" fill={L} />
  </>),
  zip: (a) => (<>
    <path d="M5 5.5h7.5v6H8v8h11" stroke={a} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5" cy="5.5" r="1.9" fill={L} />
    <path d="M17.5 17.5L21.5 19.5 17.5 21.5" stroke={L} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  pinpoint: (a) => (<>
    <path d="M12 21.5c4.2-5.2 6.2-8.4 6.2-11.5a6.2 6.2 0 0 0-12.4 0c0 3.1 2 6.3 6.2 11.5z" stroke={L} strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.4" fill={a} />
  </>),
  crossclimb: (a) => (<>
    <path d="M8 3v18 M16 3v18" stroke={L} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M8 6.5h8 M8 11h8 M8 15.5h8 M8 20h8" stroke={a} strokeWidth="1.6" strokeLinecap="round" />
  </>),
  spin: (a) => (<>
    <circle cx="12" cy="12.5" r="8.2" stroke={L} strokeWidth="1.6" />
    <path d="M12 4.3V12.5L18 16.5 M12 12.5L6 16.5" stroke={L} strokeWidth="1.2" opacity="0.7" strokeLinecap="round" />
    <circle cx="12" cy="12.5" r="2" fill={a} />
    <path d="M12 1.4l2 3h-4z" fill={a} />
  </>),
  sos: (a) => (<>
    <circle cx="5" cy="12" r="2.3" stroke={L} strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2.3" stroke={L} strokeWidth="1.5" />
    <circle cx="19" cy="12" r="2.3" stroke={L} strokeWidth="1.5" />
    <path d="M3.6 14.4L20.4 9.6" stroke={a} strokeWidth="1.9" strokeLinecap="round" />
  </>),
  countdown: (a) => (<>
    <rect x="3" y="3" width="8" height="8" rx="2.2" fill={a} />
    <rect x="13" y="3" width="8" height="8" rx="2.2" stroke={L} strokeWidth="1.6" />
    <rect x="3" y="13" width="8" height="8" rx="2.2" stroke={L} strokeWidth="1.6" />
    <rect x="13" y="13" width="8" height="8" rx="2.2" fill={a} />
  </>),
  chain: (a) => (<>
    <path d="M4.5 16.5l5-5 4 3 6-6.5" stroke={L} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="4.5" cy="16.5" r="1.8" fill={a} />
    <circle cx="9.5" cy="11.5" r="1.7" fill={L} />
    <circle cx="13.5" cy="14.5" r="1.7" fill={L} />
    <circle cx="19.5" cy="8" r="1.8" fill={a} />
  </>),
  towers: (a) => (<>
    <rect x="5" y="15" width="14" height="5" rx="1.6" stroke={L} strokeWidth="1.6" />
    <rect x="6.6" y="9.6" width="10.8" height="5" rx="1.6" stroke={L} strokeWidth="1.6" />
    <rect x="8.2" y="4.2" width="7.6" height="5" rx="1.6" fill={a} />
  </>),
  sprout: (a) => (<>
    <path d="M12 21v-7.5" stroke={L} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 14.5c0-3.2-2.6-5.2-5.8-5.2 0 3.2 2.6 5.2 5.8 5.2z" fill={a} />
    <path d="M12 12.2c0-3.2 2.6-5.2 5.8-5.2 0 3.2-2.6 5.2-5.8 5.2z" fill={L} opacity="0.88" />
  </>),
  skull: (a) => (<>
    <path d="M12 2.8c-4.4 0-7.6 3-7.6 7.1 0 2.6 1.3 4.4 3.1 5.4v2.4A1.6 1.6 0 0 0 9.1 20.3h5.8a1.6 1.6 0 0 0 1.6-1.6v-2.4c1.8-1 3.1-2.8 3.1-5.4 0-4.1-3.2-7.1-7.6-7.1z" stroke={L} strokeWidth="1.6" />
    <circle cx="9" cy="10.8" r="1.9" fill={a} />
    <circle cx="15" cy="10.8" r="1.9" fill={a} />
    <path d="M10 20v-2.2 M12 20.3v-2.2 M14 20v-2.2" stroke={L} strokeWidth="1.3" strokeLinecap="round" />
  </>),
  chip: (a) => (<>
    <rect x="6" y="6" width="12" height="12" rx="2.6" stroke={L} strokeWidth="1.6" />
    <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1.1" fill={a} />
    <path d="M9 6V3 M15 6V3 M9 21v-3 M15 21v-3 M6 9H3 M6 15H3 M21 9h-3 M21 15h-3" stroke={L} strokeWidth="1.5" strokeLinecap="round" />
  </>),
  shield: (a) => (<>
    <path d="M12 2.6l7 2.5v5.6c0 4.4-2.9 7.6-7 9-4.1-1.4-7-4.6-7-9V5.1z" stroke={L} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8.8 12.2l2.2 2.2 4.2-4.6" stroke={a} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  medal: (a) => (<>
    <path d="M8.5 8.5L5.5 2.5 M15.5 8.5l3-6" stroke={L} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="14.5" r="6" stroke={L} strokeWidth="1.7" />
    <circle cx="12" cy="14.5" r="2.4" fill={a} />
  </>),
  flame: (a) => (<>
    <path d="M12.5 2.5c.5 3 4.5 4.8 4.5 9.5a5 5 0 0 1-10 0c0-2.2 1-3.4 1.8-4.3.2 1.2.9 1.9 1.8 2.1C11 8 10 5.5 12.5 2.5z" fill={a} />
    <path d="M12 19.5a2.6 2.6 0 0 1-2.6-2.6c0-1.4 1-2 1.6-3 .5 1.4 2.3 1.7 2.3 3.2A2.3 2.3 0 0 1 12 19.5z" fill={L} opacity="0.9" />
  </>),
  lock: (a) => (<>
    <rect x="4.5" y="10.4" width="15" height="10.6" rx="2.6" stroke={L} strokeWidth="1.7" />
    <path d="M7.6 10.4V8a4.4 4.4 0 0 1 8.8 0v2.4" stroke={L} strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="14.8" r="1.9" fill={a} />
    <path d="M12 16.3V18.4" stroke={a} strokeWidth="1.8" strokeLinecap="round" />
  </>),
}

export default function GameIcon({ icon = 'gtn', size = 44, accent }) {
  const a = accent || ACCENTS[icon] || '#00F5FF'
  const radius = Math.round(size * 0.3)
  const glyph = Math.round(size * 0.54)
  const draw = GLYPHS[icon] || GLYPHS.gtn

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: radius,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(158deg, color-mix(in srgb, ${a} 36%, #2A2360), color-mix(in srgb, ${a} 9%, #1A1640))`,
        border: `1px solid color-mix(in srgb, ${a} 48%, rgba(255,255,255,0.05))`,
        boxShadow: `0 6px 16px rgba(0,0,0,0.45), 0 0 20px color-mix(in srgb, ${a} 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -7px 14px rgba(0,0,0,0.3)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0, right: 0, top: 0,
          height: '55%',
          borderRadius: `${radius}px ${radius}px 40% 40%`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)',
          pointerEvents: 'none',
        }}
      />
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        style={{ position: 'relative', display: 'block', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }}
      >
        {draw(a)}
      </svg>
    </div>
  )
}
