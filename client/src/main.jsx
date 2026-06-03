import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './styles/accessibility.css'
import { registerServiceWorker } from './services/pwa.js'

registerServiceWorker()

// Clear stale guest-mode flag from localStorage (old builds stored it there)
localStorage.removeItem('ns_guest_mode')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
