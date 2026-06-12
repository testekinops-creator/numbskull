// Bump this on every deploy that changes caching behaviour — `activate` purges
// any cache whose name doesn't match, so old/stale assets can't linger.
const CACHE_NAME = 'numbskull-v2'
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

// ── Fetch: network-first, with a SAFE offline fallback ───────────────────────
// Critical: only ever serve the offline HTML page for *navigation* requests.
// Returning HTML for a failed .js/.css/asset request poisons the page — the
// browser tries to execute HTML as a script (→ crash / blank ErrorBoundary) or
// parse it as CSS (→ unstyled). Assets that can't be fetched or found in cache
// fail cleanly instead.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return
  if (request.method !== 'GET') return

  const isNavigation = request.mode === 'navigate' || request.destination === 'document'

  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      if (response.ok && url.origin === self.location.origin) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
      }
      return response
    } catch {
      const cached = await caches.match(request)
      if (cached) return cached
      // Only navigations may fall back to the offline shell/page.
      if (isNavigation) return (await caches.match('/')) || _offlineFallback()
      // A script/style/image we can't fulfil — fail cleanly, never return HTML.
      return Response.error()
    }
  })())
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
    <style>
      *{box-sizing:border-box;margin:0}
      body{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;
        font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;color:#EEEDFE;
        background:radial-gradient(120% 80% at 50% 0%,rgba(124,77,255,.18),transparent 60%),#14102B}
      .card{width:100%;max-width:380px;padding:34px 26px;border-radius:20px;
        background:linear-gradient(160deg,#2a2350,#16132f);border:1px solid rgba(255,255,255,.1);
        box-shadow:0 22px 60px rgba(0,0,0,.55),0 0 44px rgba(124,77,255,.14)}
      .badge{width:64px;height:64px;margin:0 auto 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        font-size:28px;background:radial-gradient(circle at 50% 32%,#5cfaff,#7c4dff);
        box-shadow:0 8px 24px rgba(0,245,255,.32),inset 0 2px 6px rgba(255,255,255,.45)}
      h1{font-size:1.6rem;font-weight:800;margin-bottom:10px}
      p{color:#AFA9EC;font-size:.95rem;line-height:1.55}
    </style></head>
    <body><div class="card"><div class="badge">📡</div><h1>You're offline</h1>
    <p>Numbskull needs a connection to roast you properly. Check your internet and try again.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}
