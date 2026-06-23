import { memo } from 'react'
import styles from './SkullMascot.module.css'

// Numbskull mascot — a premium little AI/robot rival (the one that roasts you).
// Mood comes from the brow tilt, eye size and mouth curve. Kept the original
// export name + API (expression / size / glow / className) so every call site
// upgrades at once. Expressions: neutral · judging · annoyed · grudging · evil · impressed.
const EXPRESSIONS = {
  neutral:   { browL: 'M36 44 H50', browR: 'M70 44 H84', eyeRy: 7.0, mouth: 'M50 82 Q60 85 70 82', open: false },
  judging:   { browL: 'M36 45 L50 43', browR: 'M70 43 L84 45', eyeRy: 4.4, mouth: 'M51 82 H69', open: false },
  annoyed:   { browL: 'M36 42 L50 46', browR: 'M70 46 L84 42', eyeRy: 4.0, mouth: 'M50 83 Q56 78 60 81 Q64 84 70 79', open: false },
  grudging:  { browL: 'M36 44 L50 45', browR: 'M70 45 L84 44', eyeRy: 6.0, mouth: 'M50 82 Q60 79 70 82', open: false },
  evil:      { browL: 'M36 41 L50 46', browR: 'M70 46 L84 41', eyeRy: 3.6, mouth: 'M48 79 Q60 88 72 79', open: true },
  impressed: { browL: 'M36 43 L50 38', browR: 'M70 38 L84 43', eyeRy: 9.0, mouth: 'M48 79 Q60 91 72 79', open: true },
}

const EYE = { lx: 43, rx: 77, cy: 58 }

function SkullMascot({ expression = 'neutral', size = 120, glow = true, className = '' }) {
  const e = EXPRESSIONS[expression] || EXPRESSIONS.neutral
  const isWin = expression === 'impressed' || expression === 'evil'
  const id = expression

  const eye = (cx) => (
    <g key={cx}>
      <ellipse cx={cx} cy={EYE.cy} rx={9} ry={e.eyeRy + 2.4} fill="rgba(0,245,255,0.14)" />
      <ellipse cx={cx} cy={EYE.cy} rx={7} ry={e.eyeRy} fill="#00F5FF" filter={`url(#rb_eye_${id})`} />
      <ellipse cx={cx - 1.8} cy={EYE.cy - e.eyeRy * 0.45} rx="1.6" ry="1.1" fill="#fff" opacity="0.9" />
    </g>
  )

  return (
    <span key={expression} className={styles.expressionSwap}>
      <svg
        width={size} height={size} viewBox="0 0 120 128" fill="none" xmlns="http://www.w3.org/2000/svg"
        className={[styles.skull, glow && styles.glowPulse, isWin && styles.winGlow, className].filter(Boolean).join(' ')}
        role="img" aria-label={`Numbskull mascot — ${expression}`}
      >
        <defs>
          <linearGradient id={`rb_body_${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#4A4396" />
            <stop offset="55%" stopColor="#332C6E" />
            <stop offset="100%" stopColor="#211B49" />
          </linearGradient>
          <radialGradient id={`rb_screen_${id}`} cx="50%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#161232" />
            <stop offset="100%" stopColor="#0A0820" />
          </radialGradient>
          <filter id={`rb_eye_${id}`} x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* antenna */}
        <line x1="60" y1="16" x2="60" y2="7" stroke="#6E68A8" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="5.5" r="3.4" fill="#00F5FF" filter={`url(#rb_eye_${id})`} />

        {/* ear pods */}
        <rect x="11" y="52" width="9" height="24" rx="4.5" fill={`url(#rb_body_${id})`} />
        <rect x="100" y="52" width="9" height="24" rx="4.5" fill={`url(#rb_body_${id})`} />
        <rect x="13" y="58" width="5" height="12" rx="2.5" fill="#00F5FF" opacity="0.55" />
        <rect x="102" y="58" width="5" height="12" rx="2.5" fill="#00F5FF" opacity="0.55" />

        {/* head shell */}
        <rect x="18" y="16" width="84" height="94" rx="26" fill={`url(#rb_body_${id})`} />
        {/* crisp top rim-light + sheen */}
        <path d="M30 30 Q60 20 90 30" stroke="#9C96DC" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        <ellipse cx="60" cy="28" rx="22" ry="8" fill="#fff" opacity="0.08" />

        {/* face screen */}
        <rect x="28" y="32" width="64" height="62" rx="18" fill={`url(#rb_screen_${id})`} />
        <rect x="28" y="32" width="64" height="62" rx="18" fill="none" stroke="#00F5FF" strokeWidth="1" opacity="0.22" />
        {/* screen sheen */}
        <path d="M34 40 Q44 34 58 35" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.10" />

        {/* brows (mood) */}
        <path d={e.browL} stroke="#8E88C8" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={e.browR} stroke="#8E88C8" strokeWidth="3" strokeLinecap="round" fill="none" />

        {eye(EYE.lx)}
        {eye(EYE.rx)}

        {/* mouth (mood) — glowing display line */}
        {e.open
          ? <path d={e.mouth} fill="rgba(0,245,255,0.12)" stroke="#00F5FF" strokeWidth="2" strokeLinecap="round" filter={`url(#rb_eye_${id})`} />
          : <path d={e.mouth} stroke="#00F5FF" strokeWidth="2.2" strokeLinecap="round" fill="none" filter={`url(#rb_eye_${id})`} />}

        {/* chin / neck */}
        <rect x="50" y="108" width="20" height="7" rx="3" fill={`url(#rb_body_${id})`} />
      </svg>
    </span>
  )
}

export default memo(SkullMascot)
