import { useEffect, useState } from 'react'
import { Analytics } from '../services/analytics.js'

export function usePWAInstall() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
    }
    function onAppInstalled() {
      setInstalled(true)
      setPrompt(null)
      Analytics.installPWA()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setPrompt(null)
    return outcome === 'accepted'
  }

  return { canInstall: !!prompt && !installed, installed, install }
}
