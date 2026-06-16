import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './styles/accessibility.css'
import { registerServiceWorker } from './services/pwa.js'

// The service worker is a PRODUCTION concern (offline shell + push). In dev it
// only causes grief: it caches the app and serves stale code even through a hard
// refresh. So register it only in prod, and in dev actively unregister any SW a
// previous session left behind + purge its caches so the browser self-heals to
// the live dev bundle.
if (import.meta.env.PROD) {
  registerServiceWorker()
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {})
  if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
}

// Clear stale guest-mode flag from localStorage (old builds stored it there)
localStorage.removeItem('ns_guest_mode')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
