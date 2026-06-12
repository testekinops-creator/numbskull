// In production use the Railway server URL, in dev use the Vite proxy
const SERVER = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '')
const BASE = SERVER ? `${SERVER}/api` : '/api'
let _token = null

// Default per-request timeout. Without one, fetch() can hang indefinitely on a
// slow/flaky connection (or a cold server) — which left "Play vs AI" stuck on a
// disabled Start button forever. Now a hung request aborts and surfaces a clear,
// retryable error instead.
const DEFAULT_TIMEOUT_MS = 20_000

async function request(method, path, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: import.meta.env.VITE_SOCKET_URL ? 'omit' : 'include',
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('The server is taking too long — check your connection and try again.')
      err.code = 'TIMEOUT'
      throw err
    }
    const err = new Error('Could not reach the server — check your connection.')
    err.code = 'NETWORK'
    throw err
  } finally {
    clearTimeout(timer)
  }

  // A waking/cold server (or a proxy) can return a non-JSON page; don't crash on it.
  let json
  try {
    json = await res.json()
  } catch {
    const err = new Error('The server is waking up — try again in a moment.')
    err.code = 'BAD_RESPONSE'
    err.status = res.status
    throw err
  }

  if (!json.success) {
    const err = new Error(json.error?.message || 'Request failed')
    err.code   = json.error?.code
    err.status = json.error?.status || res.status
    throw err
  }
  return json.data
}

// Fetch a raw file (e.g. the GDPR export, which returns a JSON attachment, not
// the {success,data} envelope) WITH the auth token + correct API base, so it
// works on the deployed cross-origin server (a plain <a href> can't send the token).
async function getBlob(path) {
  const headers = {}
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${BASE}${path}`, {
    headers,
    credentials: import.meta.env.VITE_SOCKET_URL ? 'omit' : 'include',
  })
  if (!res.ok) {
    const err = new Error('Request failed')
    err.status = res.status
    throw err
  }
  return res.blob()
}

export const api = {
  get:     (path, opts)       => request('GET',    path, undefined, opts),
  post:    (path, body, opts) => request('POST',   path, body, opts),
  put:     (path, body, opts) => request('PUT',    path, body, opts),
  patch:   (path, body, opts) => request('PATCH',  path, body, opts),
  del:     (path, opts)       => request('DELETE', path, undefined, opts),
  getBlob,
  setToken: (t)               => { _token = t },
}
