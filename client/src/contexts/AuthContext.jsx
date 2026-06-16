import { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { api } from '../services/api.js'
import { clearGuestMode } from '../utils/guestMode.js'

const AuthContext = createContext(null)
const TOKEN_KEY   = 'ns_access_token'
const REFRESH_KEY = 'ns_refresh_token'
const USER_KEY    = 'ns_user'

const INITIAL = { user: null, accessToken: null, loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':       return { ...state, user: action.user, accessToken: action.accessToken, loading: false }
    case 'UPDATE_USER': return { ...state, user: action.user }
    case 'LOGOUT':      return { ...INITIAL, loading: false }
    case 'LOADED':      return { ...state, loading: false }
    default:            return state
  }
}

function saveAuth(accessToken, refreshToken, user) {
  localStorage.setItem(TOKEN_KEY,   accessToken)
  localStorage.setItem(USER_KEY,    JSON.stringify(user))
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

async function tryRefreshWithStoredToken() {
  const storedRefresh = localStorage.getItem(REFRESH_KEY)
  if (!storedRefresh) throw new Error('No refresh token')
  const data = await api.post('/auth/refresh', { refreshToken: storedRefresh })
  return data
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  // Safety net: never stay in `loading` forever. If the token-verify / refresh
  // request black-holes (flaky network, hung fetch), protected routes would
  // render blank with no recovery. Force-resolve to "loaded" after a few seconds
  // so the app is always interactive; a slow LOGIN that arrives later still wins.
  useEffect(() => {
    const t = setTimeout(() => dispatch({ type: 'LOADED' }), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const token    = localStorage.getItem(TOKEN_KEY)
    const userRaw  = localStorage.getItem(USER_KEY)

    if (token && userRaw) {
      try {
        api.setToken(token)
        // Verify access token is still valid
        api.get('/auth/me')
          .then(data => {
            dispatch({ type: 'LOGIN', user: data.user, accessToken: token })
          })
          .catch(async () => {
            // Access token expired — use stored refresh token
            try {
              const data = await tryRefreshWithStoredToken()
              api.setToken(data.accessToken)
              saveAuth(data.accessToken, data.refreshToken, data.user)
              dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
            } catch {
              clearAuth()
              dispatch({ type: 'LOADED' })
            }
          })
      } catch {
        clearAuth()
        dispatch({ type: 'LOADED' })
      }
    } else {
      // No stored token — try cookie-based refresh (works on localhost)
      api.post('/auth/refresh', {})
        .then(data => {
          api.setToken(data.accessToken)
          saveAuth(data.accessToken, data.refreshToken, data.user)
          dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
        })
        .catch(() => dispatch({ type: 'LOADED' }))
    }
  }, [])

  const register = useCallback(async ({ email, username, password, guestId }) => {
    const data = await api.post('/auth/register', { email, username, password, guestId })
    api.setToken(data.accessToken)
    saveAuth(data.accessToken, data.refreshToken, data.user)
    clearGuestMode()   // a real account supersedes any guest session
    dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
    return data.user
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await api.post('/auth/login', { email, password })
    api.setToken(data.accessToken)
    saveAuth(data.accessToken, data.refreshToken, data.user)
    clearGuestMode()
    dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
    return data.user
  }, [])

  // Social sign-in. `provider` is 'google' | 'facebook'; `payload` carries the
  // verified provider token ({ credential } for Google, { accessToken } for FB).
  const socialLogin = useCallback(async (provider, payload) => {
    const data = await api.post(`/auth/${provider}`, payload)
    api.setToken(data.accessToken)
    saveAuth(data.accessToken, data.refreshToken, data.user)
    clearGuestMode()
    dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    api.setToken(null)
    clearAuth()
    clearGuestMode()   // logging out should fully sign out — not drop back into guest
    dispatch({ type: 'LOGOUT' })
  }, [])

  // Update the cached user (e.g. after recording a game) + persist
  const updateUser = useCallback((user) => {
    if (!user) return
    const token = localStorage.getItem(TOKEN_KEY)
    // Level-up celebration: compare against the previously cached profile.
    try {
      const prev = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
      if (prev && typeof prev.level === 'number' && typeof user.level === 'number' && user.level > prev.level) {
        window.dispatchEvent(new CustomEvent('ns-level-up', { detail: { level: user.level } }))
      }
    } catch { /* ignore */ }
    if (token) saveAuth(token, localStorage.getItem(REFRESH_KEY), user)
    dispatch({ type: 'UPDATE_USER', user })
  }, [])

  // Pull fresh user data from the server
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me')
      updateUser(data.user)
      return data.user
    } catch {
      return null
    }
  }, [updateUser])

  const isRegistered = !!state.user

  return (
    <AuthContext.Provider value={{ ...state, isRegistered, register, login, socialLogin, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
