import { useMemo } from 'react'
import s from './MatrixRain.module.css'

// Matrix-style digital rain background (CSS Modules port of the styled-components
// snippet). Columns are generated in JS — randomized glyphs / speed / delay — so
// we get variety without 200 hand-written divs. Colour is a CSS var (--matrix),
// defaulted to the brand cyan; swap it for #00ff41 to get classic green.
// Numbskull is a NUMBER game → the rain is digits (with a few math operators).
const GLYPHS = '0123456789012345678901234567890123456789+-×÷=%'

function randomStream(len) {
  let out = ''
  for (let i = 0; i < len; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0]
  return out
}

export default function MatrixRain({ columns = 28 }) {
  // Each column gets its own delay + speed → staggered, organic rise.
  const cols = useMemo(
    () => Array.from({ length: columns }, (_, i) => ({
      left: (i / columns) * 100,
      delay: -(Math.random() * 8).toFixed(2),
      duration: (6 + Math.random() * 5).toFixed(2),   // slow drift: 6s–11s
      text: randomStream(64),
    })),
    [columns],
  )

  return (
    <div className={s.rain} aria-hidden="true">
      {cols.map((c, i) => (
        <span
          key={i}
          className={s.col}
          style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
        >
          {c.text}
        </span>
      ))}
    </div>
  )
}
