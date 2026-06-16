import { api } from './api.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

// High-level enable/disable used by the Settings toggle: request permission,
// subscribe via the service worker, and register the subscription server-side.
// Returns { ok, reason } so the UI can explain failures. No-ops cleanly in dev
// (no service worker) or when VAPID isn't configured.
export async function enablePushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'not-configured' }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return { ok: false, reason: 'unsupported' }   // dev / no SW → push unavailable
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }
  const sub = await subscribeToPush()
  if (!sub) return { ok: false, reason: 'subscribe-failed' }
  try {
    await api.post('/push/subscribe', sub.toJSON ? sub.toJSON() : sub)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'server' }
  }
}

export async function disablePushNotifications() {
  try { await api.del('/push/subscribe') } catch { /* best effort */ }
  await unsubscribeFromPush()
  return { ok: true }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (err) {
    console.warn('SW registration failed:', err)
    return null
  }
}

export async function subscribeToPush() {
  if (!('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    return sub
  } catch {
    return null
  }
}

export async function unsubscribeFromPush() {
  if (!('PushManager' in window)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()
}

export function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

export function canInstallPWA() {
  return 'BeforeInstallPromptEvent' in window || !isPWAInstalled()
}

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
