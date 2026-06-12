import { lazy } from 'react'

// React.lazy hardened for flaky / mobile-data networks. Two problems with plain
// `lazy(() => import(...))`:
//   1) a stalled chunk request can hang forever (no timeout) → the Suspense
//      fallback spins indefinitely;
//   2) a transient failure (or a stale chunk right after a deploy) rejects with
//      no retry → a dead screen.
// So each import attempt is time-boxed and retried with backoff. A cached chunk
// (served by the service worker once the network attempt times out) lets a retry
// succeed; if it still can't load, we reject so the ErrorBoundary's premium
// "reload" screen shows — never an endless spinner.
const ATTEMPT_TIMEOUT_MS = 9000
const RETRIES = 2
const BACKOFF_MS = 700

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('chunk-load-timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function lazyWithRetry(importFn) {
  return lazy(async () => {
    let lastErr
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        return await withTimeout(importFn(), ATTEMPT_TIMEOUT_MS)
      } catch (err) {
        lastErr = err
        if (attempt < RETRIES) await new Promise(r => setTimeout(r, BACKOFF_MS * (attempt + 1)))
      }
    }
    throw lastErr
  })
}
