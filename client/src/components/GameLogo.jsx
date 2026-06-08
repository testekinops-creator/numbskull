import { useRef } from 'react'
import s from './GameLogo.module.css'

// Premium animated game logo. Artwork lives at client/public/logo.png.
//   variant="hero"   → full motion (spring intro · float · breathing glow ·
//                      silhouette sheen sweep · desktop pointer tilt). Title/splash.
//   variant="static" → calm: image + soft glow + a gentle pop-in. In-game branding.
export default function GameLogo({ size = 200, variant = 'hero' }) {
  const ref = useRef(null)
  const interactive = variant === 'hero'

  function onMove(e) {
    if (!interactive) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-py * 14).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(px * 14).toFixed(2)}deg`)
  }
  function reset() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  const style = { '--logo-size': typeof size === 'number' ? `${size}px` : size }

  if (variant === 'static') {
    return (
      <div className={`${s.logo} ${s.static}`} style={style}>
        <img src="/logo.png" alt="Numbskull" className={s.img} draggable="false" />
      </div>
    )
  }

  return (
    <div ref={ref} className={s.logo} style={style} onPointerMove={onMove} onPointerLeave={reset}>
      <div className={s.float}>
        <div className={s.tilt}>
          <img src="/logo.png" alt="Numbskull" className={s.img} draggable="false" />
          <span className={s.sheen} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
