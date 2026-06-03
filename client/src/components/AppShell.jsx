import { useEffect } from 'react'

const CB_KEY = 'ns_colorblind_mode'

export function useColorblindMode() {
  useEffect(() => {
    const mode = localStorage.getItem(CB_KEY)
    if (mode) document.documentElement.classList.add(`colorblind-${mode}`)
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
