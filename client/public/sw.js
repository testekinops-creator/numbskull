const CACHE_NAME = 'numbskull-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
]

// ── Install: cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
})

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: network-first for API, cache-first for static ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return

  if (request.method !== 'GET') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || _offlineFallback()))
  )
})

// ── Push notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title   = data.title   || 'Numbskull'
  const options = {
    body:    data.body    || 'You have a new notification.',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    tag:     data.tag     || 'numbskull-default',
    data:    data.url     ? { url: data.url } : {},
    vibrate: [100, 50, 100],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === targetUrl)
      return existing ? existing.focus() : self.clients.openWindow(targetUrl)
    })
  )
})

function _offlineFallback() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Numbskull — Offline</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{background:#1C1842;color:#EEEDFE;font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:1rem;text-align:center;padding:2rem}
    h1{font-size:2rem;color:#00F5FF}p{color:#AFA9EC}</style></head>
    <body><h1>💀 You're offline</h1><p>Numbskull needs a connection to roast you properly.</p><p>Check your internet and try again.</p></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
