import { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

const INITIAL = { user: null, accessToken: null, loading: true }

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':  return { ...state, user: action.user, accessToken: action.accessToken, loading: false }
    case 'LOGOUT': return { ...INITIAL, loading: false }
    case 'LOADED': return { ...state, loading: false }
    default:       return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  useEffect(() => {
    api.post('/auth/refresh', {})
      .then(data => dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken }))
      .catch(() => dispatch({ type: 'LOADED' }))
  }, [])

  const register = useCallback(async ({ email, username, password, guestId }) => {
    const data = await api.post('/auth/register', { email, username, password, guestId })
    api.setToken(data.accessToken)
    dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
    return data.user
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await api.post('/auth/login', { email, password })
    api.setToken(data.accessToken)
    dispatch({ type: 'LOGIN', user: data.user, accessToken: data.accessToken })
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout', {}).catch(() => {})
    api.setToken(null)
    dispatch({ type: 'LOGOUT' })
  }, [])

  const isRegistered = !!state.user

  return (
    <AuthContext.Provider value={{ ...state, isRegistered, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
