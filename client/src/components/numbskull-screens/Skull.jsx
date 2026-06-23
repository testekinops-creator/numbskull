// Skull.jsx — the Numbskull mascot. Expressions: neutral | judging | annoyed | evil | impressed
// <Skull expression="impressed" size={150} glow />
import './numbskull.css'

const E = {
  neutral:   { leftBrow:'M 32 44 Q 44 38 52 42', rightBrow:'M 68 42 Q 76 38 88 44', pL:{cx:43,cy:60}, pR:{cx:77,cy:60}, ry:5,   mouth:'M 42 94 Q 60 100 78 94', fill:false },
  judging:   { leftBrow:'M 32 42 Q 44 46 52 43', rightBrow:'M 68 40 Q 76 37 88 42', pL:{cx:42,cy:62}, pR:{cx:78,cy:61}, ry:3.5, mouth:'M 42 93 Q 60 90 78 93', fill:false },
  annoyed:   { leftBrow:'M 32 44 Q 44 36 52 39', rightBrow:'M 68 39 Q 76 36 88 44', pL:{cx:43,cy:62}, pR:{cx:77,cy:62}, ry:3,   mouth:'M 42 95 Q 52 90 60 93 Q 68 96 78 91', fill:false },
  evil:      { leftBrow:'M 32 46 Q 44 36 52 40', rightBrow:'M 68 40 Q 76 36 88 46', pL:{cx:42,cy:63}, pR:{cx:78,cy:63}, ry:4,   mouth:'M 38 91 Q 48 102 60 104 Q 72 102 82 91', fill:true },
  impressed: { leftBrow:'M 32 40 Q 44 32 52 37', rightBrow:'M 68 37 Q 76 32 88 40', pL:{cx:43,cy:58}, pR:{cx:77,cy:58}, ry:5.5, mouth:'M 38 92 Q 60 106 82 92', fill:true },
}

export default function Skull({ expression = 'neutral', size = 120, glow = true }) {
  const e = E[expression] || E.neutral
  const sizeH = Math.round((size * 128) / 120)
  const win = expression === 'impressed' || expression === 'evil'
  const cls = glow ? (win ? 'sk-win' : 'sk-glow') : ''
  const ry = e.ry

  return (
    <svg width={size} height={sizeH} viewBox="0 0 120 128" fill="none" className={cls} role="img" aria-label="Numbskull mascot">
      <defs>
        <radialGradient id="sk_bone" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor="#D4D0F0" /><stop offset="45%" stopColor="#A9A3D8" /><stop offset="100%" stopColor="#4A4490" />
        </radialGradient>
        <radialGradient id="sk_jaw" cx="50%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#B8B3DC" /><stop offset="100%" stopColor="#3D3880" />
        </radialGradient>
        <radialGradient id="sk_socket" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#050310" /><stop offset="100%" stopColor="#0D0A22" />
        </radialGradient>
        <filter id="sk_eyeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="60" cy="50" rx="43" ry="46" fill="#1A163C" />
      <ellipse cx="60" cy="48" rx="41" ry="44" fill="url(#sk_bone)" />
      <ellipse cx="22" cy="54" rx="9" ry="20" fill="#3A3478" opacity="0.5" />
      <ellipse cx="98" cy="54" rx="9" ry="20" fill="#3A3478" opacity="0.5" />
      <path d="M 28 47 Q 60 42 92 47" stroke="#6A64A4" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4" />
      <ellipse cx="60" cy="22" rx="18" ry="8" fill="white" opacity="0.07" />
      <path d="M 22 78 Q 18 93 26 107 Q 37 120 60 121 Q 83 120 94 107 Q 102 93 98 78 Z" fill="url(#sk_jaw)" />
      <path d="M 22 78 Q 18 93 26 107" stroke="#5A5494" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M 98 78 Q 102 93 94 107" stroke="#5A5494" strokeWidth="2" fill="none" opacity="0.6" />
      <ellipse cx="43" cy="59" rx="18" ry="16" fill="url(#sk_socket)" />
      <ellipse cx="43" cy="59" rx="18" ry="16" fill="none" stroke="#7A74B4" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="77" cy="59" rx="18" ry="16" fill="url(#sk_socket)" />
      <ellipse cx="77" cy="59" rx="18" ry="16" fill="none" stroke="#7A74B4" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx={e.pL.cx} cy={e.pL.cy} rx="8" ry={ry + 2} fill="rgba(0,245,255,0.12)" />
      <ellipse cx={e.pR.cx} cy={e.pR.cy} rx="8" ry={ry + 2} fill="rgba(0,245,255,0.12)" />
      <ellipse cx={e.pL.cx} cy={e.pL.cy} rx="6" ry={ry + 0.5} fill="rgba(0,245,255,0.25)" />
      <ellipse cx={e.pR.cx} cy={e.pR.cy} rx="6" ry={ry + 0.5} fill="rgba(0,245,255,0.25)" />
      <ellipse cx={e.pL.cx} cy={e.pL.cy} rx="4.5" ry={ry} fill="#00F5FF" filter="url(#sk_eyeGlow)" />
      <ellipse cx={e.pR.cx} cy={e.pR.cy} rx="4.5" ry={ry} fill="#00F5FF" filter="url(#sk_eyeGlow)" />
      <ellipse cx={e.pL.cx - 1.5} cy={e.pL.cy - 1.5} rx="1.5" ry="1" fill="white" opacity="0.85" />
      <ellipse cx={e.pR.cx - 1.5} cy={e.pR.cy - 1.5} rx="1.5" ry="1" fill="white" opacity="0.85" />
      <path d={e.leftBrow} stroke="#9490CC" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d={e.rightBrow} stroke="#9490CC" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M 60 79 C 56 74 50 75 50 80 C 50 85 55 88 60 91 C 65 88 70 85 70 80 C 70 75 64 74 60 79 Z" fill="#060413" opacity="0.9" />
      <path d="M 38 101 Q 60 104 82 101" stroke="#8078B8" strokeWidth="1.5" fill="none" opacity="0.6" />
      <rect x="40" y="100" width="9" height="13" rx="3" fill="#E8E5F8" />
      <rect x="51" y="100" width="9" height="14" rx="3" fill="#EDEAFB" />
      <rect x="62" y="100" width="9" height="14" rx="3" fill="#EDEAFB" />
      <rect x="73" y="100" width="9" height="13" rx="3" fill="#E8E5F8" />
      <rect x="49" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />
      <rect x="60" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />
      <rect x="71" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />
      {e.fill
        ? <path d={e.mouth} fill="#0A0820" stroke="#7068A8" strokeWidth="1.5" strokeLinecap="round" />
        : <path d={e.mouth} stroke="#7068A8" strokeWidth="2" strokeLinecap="round" fill="none" />}
      <path d="M 60 8 L 57 18 L 62 23 L 58 32 L 61 36" stroke="rgba(0,245,255,0.2)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
