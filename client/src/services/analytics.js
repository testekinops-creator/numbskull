const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || ''
const CONSENT_KEY = 'ns_analytics_consent'

function hasConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'yes'
}

function plausibleReady() {
  return typeof window.plausible === 'function' && hasConsent()
}

export function trackEvent(name, props) {
  if (!plausibleReady()) return
  try {
    window.plausible(name, { props })
  } catch {}
}

export function trackPageView(path) {
  if (!plausibleReady()) return
  try {
    window.plausible('pageview', { u: `${window.location.origin}${path}` })
  } catch {}
}

export const Analytics = {
  gameStart:    (mode, difficulty) => trackEvent('game_start',    { mode, difficulty }),
  gameWin:      (mode, attempts, optimal) => trackEvent('game_win', { mode, attempts, optimal }),
  gameLoss:     (mode)  => trackEvent('game_loss',    { mode }),
  dailyPlay:    ()      => trackEvent('daily_play'),
  dailyWin:     (mode)  => trackEvent('daily_win',    { mode }),
  badgeEarned:  (slug)  => trackEvent('badge_earned', { badge: slug }),
  register:     ()      => trackEvent('register'),
  quickMatch:   (mode)  => trackEvent('quick_match',  { mode }),
  shareCard:    (mode)  => trackEvent('share_card',   { mode }),
  installPWA:   ()      => trackEvent('pwa_install'),
}

export function initAnalytics() {
  if (!PLAUSIBLE_DOMAIN || !hasConsent()) return
  if (document.getElementById('plausible-script')) return
  const script = document.createElement('script')
  script.id = 'plausible-script'
  script.defer = true
  script.dataset.domain = PLAUSIBLE_DOMAIN
  script.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(script)
}

export { hasConsent, CONSENT_KEY }
