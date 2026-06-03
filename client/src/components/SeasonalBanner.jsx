import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import styles from './SeasonalBanner.module.css'

const EVENT_THEMES = {
  spooky_october: {
    gradient: 'linear-gradient(135deg, #2D1B00 0%, #4A2800 50%, #2D1B00 100%)',
    border: 'rgba(255, 140, 0, 0.4)',
    glow: 'rgba(255, 100, 0, 0.25)',
    textColor: '#FFB347',
    badgeColor: 'rgba(255, 100, 0, 0.2)',
    badgeBorder: 'rgba(255, 120, 0, 0.5)',
    particles: ['🎃', '🕷️', '👻'],
  },
  holiday_december: {
    gradient: 'linear-gradient(135deg, #001830 0%, #002848 50%, #001830 100%)',
    border: 'rgba(100, 200, 255, 0.4)',
    glow: 'rgba(80, 180, 255, 0.2)',
    textColor: '#7DD6FF',
    badgeColor: 'rgba(80, 180, 255, 0.15)',
    badgeBorder: 'rgba(100, 200, 255, 0.4)',
    particles: ['❄️', '⛄', '🎁'],
  },
  summer_june: {
    gradient: 'linear-gradient(135deg, #1A0E00 0%, #2D1800 50%, #1A0E00 100%)',
    border: 'rgba(255, 210, 0, 0.4)',
    glow: 'rgba(255, 190, 0, 0.2)',
    textColor: '#FFD700',
    badgeColor: 'rgba(255, 190, 0, 0.15)',
    badgeBorder: 'rgba(255, 210, 0, 0.45)',
    particles: ['☀️', '🌊', '🏖️'],
  },
  new_year: {
    gradient: 'linear-gradient(135deg, #0A001A 0%, #140028 50%, #0A001A 100%)',
    border: 'rgba(200, 150, 255, 0.4)',
    glow: 'rgba(180, 120, 255, 0.2)',
    textColor: '#CC99FF',
    badgeColor: 'rgba(180, 120, 255, 0.15)',
    badgeBorder: 'rgba(200, 150, 255, 0.4)',
    particles: ['🎆', '🎇', '✨'],
  },
}

export default function SeasonalBanner() {
  const [event, setEvent] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    api.get('/seasonal')
      .then(d => {
        if (d.active) {
          setEvent(d.active)
          setTimeout(() => setVisible(true), 100)
        }
      })
      .catch(() => {})
  }, [])

  if (!event) return null

  const theme = EVENT_THEMES[event.id] || EVENT_THEMES.summer_june
  const modifiers = _modifierPills(event.modifier)

  return (
    <div
      className={`${styles.banner} ${visible ? styles.visible : ''}`}
      style={{
        background: theme.gradient,
        borderColor: theme.border,
        boxShadow: `0 0 20px ${theme.glow}, 0 2px 12px rgba(0,0,0,0.5)`,
      }}
      role="status"
      aria-live="polite"
    >
      {/* Particle decorations */}
      <div className={styles.particles}>
        {theme.particles.map((p, i) => (
          <span key={i} className={styles.particle} style={{ animationDelay: `${i * 0.4}s` }}>
            {p}
          </span>
        ))}
      </div>

      {/* Main content */}
      <div className={styles.content}>
        <span className={styles.eventName} style={{ color: theme.textColor }}>
          {event.name}
        </span>

        {modifiers.length > 0 && (
          <div className={styles.pills}>
            {modifiers.map((m, i) => (
              <span
                key={i}
                className={styles.pill}
                style={{
                  background: theme.badgeColor,
                  border: `1px solid ${theme.badgeBorder}`,
                  color: theme.textColor,
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Animated shimmer bar */}
      <div
        className={styles.shimmerBar}
        style={{ background: `linear-gradient(90deg, transparent, ${theme.border}, transparent)` }}
      />
    </div>
  )
}

function _modifierPills(m) {
  if (!m) return []
  const pills = []
  if (m.rangeBonus)    pills.push(`+${m.rangeBonus} Range`)
  if (m.timeBonusMs)   pills.push(`+${m.timeBonusMs / 1000}s Timer`)
  if (m.xpMultiplier)  pills.push(`${m.xpMultiplier}× XP`)
  if (m.maxGuessBonus) pills.push(`+${m.maxGuessBonus} Guesses`)
  return pills
}
