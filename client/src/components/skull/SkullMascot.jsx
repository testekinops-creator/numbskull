import { memo } from 'react'
import styles from './SkullMascot.module.css'

const EXPRESSIONS = {
  neutral: {
    leftBrow:   'M 32 44 Q 44 38 52 42',
    rightBrow:  'M 68 42 Q 76 38 88 44',
    pupilLeft:  { cx: 43, cy: 60 },
    pupilRight: { cx: 77, cy: 60 },
    pupilRy:    5,
    mouthPath:  'M 42 94 Q 60 100 78 94',
    mouthFill:  false,
  },
  judging: {
    leftBrow:   'M 32 42 Q 44 46 52 43',
    rightBrow:  'M 68 40 Q 76 37 88 42',
    pupilLeft:  { cx: 42, cy: 62 },
    pupilRight: { cx: 78, cy: 61 },
    pupilRy:    3.5,
    mouthPath:  'M 42 93 Q 60 90 78 93',
    mouthFill:  false,
  },
  annoyed: {
    leftBrow:   'M 32 44 Q 44 36 52 39',
    rightBrow:  'M 68 39 Q 76 36 88 44',
    pupilLeft:  { cx: 43, cy: 62 },
    pupilRight: { cx: 77, cy: 62 },
    pupilRy:    3,
    mouthPath:  'M 42 95 Q 52 90 60 93 Q 68 96 78 91',
    mouthFill:  false,
  },
  grudging: {
    leftBrow:   'M 32 44 Q 44 40 52 43',
    rightBrow:  'M 68 43 Q 76 40 88 44',
    pupilLeft:  { cx: 44, cy: 61 },
    pupilRight: { cx: 76, cy: 61 },
    pupilRy:    4,
    mouthPath:  'M 42 93 Q 60 89 78 93',
    mouthFill:  false,
  },
  evil: {
    leftBrow:   'M 32 46 Q 44 36 52 40',
    rightBrow:  'M 68 40 Q 76 36 88 46',
    pupilLeft:  { cx: 42, cy: 63 },
    pupilRight: { cx: 78, cy: 63 },
    pupilRy:    4,
    mouthPath:  'M 38 91 Q 48 102 60 104 Q 72 102 82 91',
    mouthFill:  true,
  },
  impressed: {
    leftBrow:   'M 32 40 Q 44 32 52 37',
    rightBrow:  'M 68 37 Q 76 32 88 40',
    pupilLeft:  { cx: 43, cy: 58 },
    pupilRight: { cx: 77, cy: 58 },
    pupilRy:    5.5,
    mouthPath:  'M 38 92 Q 60 106 82 92',
    mouthFill:  true,
  },
}

function SkullMascot({ expression = 'neutral', size = 120, glow = true, className = '' }) {
  const expr = EXPRESSIONS[expression] || EXPRESSIONS.neutral
  const isWin = expression === 'impressed' || expression === 'evil'
  const uid = expression // Use expression as a stable ID suffix for defs

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={[styles.skull, glow && styles.glowPulse, isWin && styles.winGlow, className]
        .filter(Boolean).join(' ')}
      aria-label={`Numbskull — ${expression}`}
      role="img"
    >
      <defs>
        {/* Bone gradient — light ivory-purple center, dark purple edges */}
        <radialGradient id={`bone_${uid}`} cx="50%" cy="38%" r="58%">
          <stop offset="0%"   stopColor="#D4D0F0" />
          <stop offset="45%"  stopColor="#A9A3D8" />
          <stop offset="100%" stopColor="#4A4490" />
        </radialGradient>

        {/* Jaw gradient */}
        <radialGradient id={`jaw_${uid}`} cx="50%" cy="20%" r="70%">
          <stop offset="0%"   stopColor="#B8B3DC" />
          <stop offset="100%" stopColor="#3D3880" />
        </radialGradient>

        {/* Deep shadow gradient for eye sockets */}
        <radialGradient id={`socket_${uid}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#050310" />
          <stop offset="100%" stopColor="#0D0A22" />
        </radialGradient>

        {/* Cyan glow filter for pupils */}
        <filter id={`eyeGlow_${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Subtle skull outer shadow */}
        <filter id={`skullShadow_${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0D0A22" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* ── CRANIUM ──────────────────────────────────────────────────── */}
      {/* Outer shadow ring */}
      <ellipse cx="60" cy="50" rx="43" ry="46" fill="#1A163C" filter={`url(#skullShadow_${uid})`} />

      {/* Main skull dome */}
      <ellipse cx="60" cy="48" rx="41" ry="44" fill={`url(#bone_${uid})`} />

      {/* Cranium side shadows — temporal regions */}
      <ellipse cx="22" cy="54" rx="9" ry="20" fill="#3A3478" opacity="0.5" />
      <ellipse cx="98" cy="54" rx="9" ry="20" fill="#3A3478" opacity="0.5" />

      {/* Forehead brow ridge (subtle) */}
      <path
        d="M 28 47 Q 60 42 92 47"
        stroke="#6A64A4"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />

      {/* Top skull highlight */}
      <ellipse cx="60" cy="22" rx="18" ry="8" fill="white" opacity="0.07" />

      {/* ── JAWBONE ──────────────────────────────────────────────────── */}
      <path
        d="M 22 78 Q 18 93 26 107 Q 37 120 60 121 Q 83 120 94 107 Q 102 93 98 78 Z"
        fill={`url(#jaw_${uid})`}
      />
      {/* Jaw side shading */}
      <path d="M 22 78 Q 18 93 26 107" stroke="#5A5494" strokeWidth="2" fill="none" opacity="0.6" />
      <path d="M 98 78 Q 102 93 94 107" stroke="#5A5494" strokeWidth="2" fill="none" opacity="0.6" />

      {/* Jaw bottom highlight */}
      <path
        d="M 34 117 Q 60 122 86 117"
        stroke="#B0ABDA"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />

      {/* ── EYE SOCKETS ──────────────────────────────────────────────── */}
      {/* Left socket — large dark hollow */}
      <ellipse cx="43" cy="59" rx="18" ry="16" fill={`url(#socket_${uid})`} />
      {/* Socket rim — bone ridge */}
      <ellipse cx="43" cy="59" rx="18" ry="16" fill="none" stroke="#7A74B4" strokeWidth="1.5" opacity="0.4" />

      {/* Right socket */}
      <ellipse cx="77" cy="59" rx="18" ry="16" fill={`url(#socket_${uid})`} />
      <ellipse cx="77" cy="59" rx="18" ry="16" fill="none" stroke="#7A74B4" strokeWidth="1.5" opacity="0.4" />

      {/* ── GLOWING PUPILS (inside sockets) ──────────────────────────── */}
      {/* Outer glow halo */}
      <ellipse cx={expr.pupilLeft.cx}  cy={expr.pupilLeft.cy}  rx="8" ry={expr.pupilRy + 2} fill="rgba(0,245,255,0.12)" />
      <ellipse cx={expr.pupilRight.cx} cy={expr.pupilRight.cy} rx="8" ry={expr.pupilRy + 2} fill="rgba(0,245,255,0.12)" />

      {/* Mid glow */}
      <ellipse cx={expr.pupilLeft.cx}  cy={expr.pupilLeft.cy}  rx="6" ry={expr.pupilRy + 0.5} fill="rgba(0,245,255,0.25)" />
      <ellipse cx={expr.pupilRight.cx} cy={expr.pupilRight.cy} rx="6" ry={expr.pupilRy + 0.5} fill="rgba(0,245,255,0.25)" />

      {/* Core glow — the actual "iris" */}
      <ellipse
        cx={expr.pupilLeft.cx}  cy={expr.pupilLeft.cy}
        rx="4.5" ry={expr.pupilRy}
        fill="#00F5FF"
        filter={`url(#eyeGlow_${uid})`}
      />
      <ellipse
        cx={expr.pupilRight.cx} cy={expr.pupilRight.cy}
        rx="4.5" ry={expr.pupilRy}
        fill="#00F5FF"
        filter={`url(#eyeGlow_${uid})`}
      />

      {/* Pupil specular glint */}
      <ellipse cx={expr.pupilLeft.cx - 1.5}  cy={expr.pupilLeft.cy - 1.5}  rx="1.5" ry="1" fill="white" opacity="0.85" />
      <ellipse cx={expr.pupilRight.cx - 1.5} cy={expr.pupilRight.cy - 1.5} rx="1.5" ry="1" fill="white" opacity="0.85" />

      {/* ── BROW BONES (expressions) ─────────────────────────────────── */}
      <path
        d={expr.leftBrow}
        stroke="#9490CC"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={expr.rightBrow}
        stroke="#9490CC"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── NOSE CAVITY ──────────────────────────────────────────────── */}
      {/* Upside-down heart / pear shaped nasal opening */}
      <path
        d="M 60 79 C 56 74 50 75 50 80 C 50 85 55 88 60 91 C 65 88 70 85 70 80 C 70 75 64 74 60 79 Z"
        fill="#060413"
        opacity="0.9"
      />
      {/* Nose rim highlight */}
      <path
        d="M 60 79 C 56 74 50 75 50 80 C 50 85 55 88 60 91 C 65 88 70 85 70 80 C 70 75 64 74 60 79 Z"
        fill="none"
        stroke="#6058A0"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* ── TEETH ────────────────────────────────────────────────────── */}
      {/* Gum line */}
      <path d="M 38 101 Q 60 104 82 101" stroke="#8078B8" strokeWidth="1.5" fill="none" opacity="0.6" />

      {/* Upper teeth — 4 teeth */}
      <rect x="40" y="100" width="9"  height="13" rx="3" fill="#E8E5F8" />
      <rect x="51" y="100" width="9"  height="14" rx="3" fill="#EDEAFB" />
      <rect x="62" y="100" width="9"  height="14" rx="3" fill="#EDEAFB" />
      <rect x="73" y="100" width="9"  height="13" rx="3" fill="#E8E5F8" />

      {/* Tooth gaps */}
      <rect x="49" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />
      <rect x="60" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />
      <rect x="71" y="100" width="2" height="14" fill="#0A0820" opacity="0.8" />

      {/* Tooth shading (right side darker) */}
      <rect x="47" y="100" width="2" height="13" rx="1" fill="#C8C4E8" opacity="0.4" />
      <rect x="58" y="100" width="2" height="14" rx="1" fill="#C8C4E8" opacity="0.4" />
      <rect x="69" y="100" width="2" height="14" rx="1" fill="#C8C4E8" opacity="0.4" />
      <rect x="80" y="100" width="2" height="13" rx="1" fill="#C8C4E8" opacity="0.4" />

      {/* ── MOUTH (expression) ───────────────────────────────────────── */}
      {expr.mouthFill ? (
        <path d={expr.mouthPath} fill="#0A0820" stroke="#7068A8" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d={expr.mouthPath} stroke="#7068A8" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}

      {/* ── SKULL CRACK (character detail) ───────────────────────────── */}
      <path
        d="M 60 8 L 57 18 L 62 23 L 58 32 L 61 36"
        stroke="rgba(0,245,255,0.2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── CHEEKBONE HIGHLIGHTS ─────────────────────────────────────── */}
      <ellipse cx="26" cy="70" rx="6" ry="4" fill="white" opacity="0.04" transform="rotate(-20 26 70)" />
      <ellipse cx="94" cy="70" rx="6" ry="4" fill="white" opacity="0.04" transform="rotate(20 94 70)" />
    </svg>
  )
}

export default memo(SkullMascot)
