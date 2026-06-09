import { useEffect } from 'react'

const CB_KEY = 'ns_colorblind_mode'

// Apply persisted display settings on app boot (before the user opens Settings).
export function useColorblindMode() {
  useEffect(() => {
    const root = document.documentElement
    const mode = localStorage.getItem(CB_KEY)
    if (mode) root.classList.add(`colorblind-${mode}`)

    // Performance Mode → flag heavy background effects (e.g. Matrix rain) to skip.
    if (localStorage.getItem('ns_performance_mode') === 'true') root.dataset.perf = '1'

    // Reduced Motion → shorten transition durations.
    if (localStorage.getItem('ns_reduced_motion') === 'true') {
      root.style.setProperty('--duration-fast',   '0.01ms')
      root.style.setProperty('--duration-normal', '0.01ms')
      root.style.setProperty('--duration-slow',   '0.01ms')
    }
  }, [])
}

export function setColorblindMode(mode) {
  const modes = ['deuteranopia', 'protanopia', 'tritanopia']
  modes.forEach(m => document.documentElement.classList.remove(`colorblind-${m}`))
  if (mode && modes.includes(mode)) {
    document.documentElement.classList.add(`colorblind-${mode}`)
    localStorage.setItem(CB_KEY, mode)
  } else {
    localStorage.removeItem(CB_KEY)
  }
}

export function SkipLink() {
  return <a href="#main-content" className="skip-link">Skip to content</a>
}
