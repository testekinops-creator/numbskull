import { useId } from 'react'

// A premium 3D Ludo pawn (glossy domed head, collar, tapered body, foot + ground
// shadow). Drawn in an SVG so it stays crisp at any size. Anchored at its base in
// LudoBoard so it "stands" on the square. `color` ∈ red/green/yellow/blue.
const STOPS = {
  red:    { hi: '#FF93A8', mid: '#FF2E54', lo: '#8E1530', rim: '#FFE0E6' },
  green:  { hi: '#73EC9D', mid: '#13C45A', lo: '#0A6E33', rim: '#D2FFE4' },
  yellow: { hi: '#FFDD7C', mid: '#FFBD0A', lo: '#9E6E00', rim: '#FFF3CE' },
  blue:   { hi: '#8DBFFF', mid: '#2C86FF', lo: '#124A88', rim: '#DCEEFF' },
}

export default function LudoToken({ color = 'red' }) {
  const c = STOPS[color] || STOPS.red
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const hd = `hd${uid}`, bd = `bd${uid}`, sh = `sh${uid}`

  return (
    <svg viewBox="0 0 44 60" width="100%" height="100%" style={{ overflow: 'visible' }} aria-hidden="true">
      <defs>
        <radialGradient id={hd} cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor={c.hi} />
          <stop offset="62%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.lo} />
        </radialGradient>
        <linearGradient id={bd} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.hi} />
          <stop offset="42%" stopColor={c.mid} />
          <stop offset="100%" stopColor={c.lo} />
        </linearGradient>
        <radialGradient id={sh} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="22" cy="56.5" rx="15" ry="3.4" fill={`url(#${sh})`} />

      {/* foot / base ring */}
      <path d="M7.5 53.5 C7.5 49 13 47 22 47 C31 47 36.5 49 36.5 53.5 C36.5 56.6 30 58 22 58 C14 58 7.5 56.6 7.5 53.5 Z"
        fill={`url(#${bd})`} stroke={c.lo} strokeWidth="0.6" />
      <ellipse cx="22" cy="51.5" rx="13" ry="3" fill={c.hi} opacity="0.28" />

      {/* tapered body */}
      <path d="M13.5 50.5 C12 42 15 34 18.2 29 L25.8 29 C29 34 32 42 30.5 50.5 C27 48.4 17 48.4 13.5 50.5 Z"
        fill={`url(#${bd})`} stroke={c.lo} strokeWidth="0.5" />

      {/* collar */}
      <ellipse cx="22" cy="29" rx="8.6" ry="2.9" fill={c.hi} />
      <ellipse cx="22" cy="29.4" rx="8.6" ry="2.5" fill={c.mid} opacity="0.55" />

      {/* head */}
      <circle cx="22" cy="18" r="12.2" fill={`url(#${hd})`} stroke={c.lo} strokeWidth="0.5" />
      {/* rim light + gloss */}
      <path d="M11.4 15.6 A12.2 12.2 0 0 1 29.5 8.4" stroke={c.rim} strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round" />
      <ellipse cx="17.4" cy="13.4" rx="4.7" ry="3.3" fill="#ffffff" opacity="0.62" />
      <circle cx="25.6" cy="22" r="2.1" fill="#ffffff" opacity="0.18" />
    </svg>
  )
}
