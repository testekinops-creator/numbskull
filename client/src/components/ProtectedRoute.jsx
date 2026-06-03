import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { isGuestMode } from '../pages/AuthGatePage.jsx'

export default function ProtectedRoute({ children }) {
  const { isRegistered, loading } = useAuth()

  // Wait for auth to resolve before deciding
  if (loading) return null

  // Allow if registered OR in guest mode
  if (isRegistered || isGuestMode()) return children

  // Not authenticated → redirect to home (which shows splash + auth gate)
  return <Navigate to="/" replace />
}
