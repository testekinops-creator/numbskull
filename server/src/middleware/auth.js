import { AuthService } from '../services/AuthService.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 } })
  }
  try {
    const payload = AuthService.verifyAccess(header.slice(7))
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token', status: 401 } })
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = AuthService.verifyAccess(header.slice(7))
      req.userId = payload.sub
      req.userRole = payload.role
    } catch {}
  }
  next()
}
