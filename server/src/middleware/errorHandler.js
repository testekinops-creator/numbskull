import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const code = err.code || 'INTERNAL_ERROR'

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error')
  }

  // Never leak internal details (e.g. raw Prisma messages) to clients on 5xx —
  // those are logged above. Only deliberate 4xx errors expose their message.
  const message = status >= 500 ? 'Something went wrong' : (err.message || 'Something went wrong')

  res.status(status).json({
    success: false,
    error: { code: status >= 500 ? 'INTERNAL_ERROR' : code, message, status },
  })
}

export function createError(message, status = 400, code = 'BAD_REQUEST') {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}
