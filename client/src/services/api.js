// In production use the Railway server URL, in dev use the Vite proxy
const SERVER = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '')
const BASE = SERVER ? `${SERVER}/api` : '/api'
let _token = null

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: import.meta.env.VITE_SOCKET_URL ? 'omit' : 'include',
  })
  const json = await res.json()
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
  get:     (path)       => request('GET',    path),
  post:    (path, body) => request('POST',   path, body),
  put:     (path, body) => request('PUT',    path, body),
  patch:   (path, body) => request('PATCH',  path, body),
  del:     (path)       => request('DELETE', path),
  getBlob,
  setToken: (t)         => { _token = t },
}
