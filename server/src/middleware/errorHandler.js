import { logger } from '../utils/logger.js'

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const code = err.code || 'INTERNAL_ERROR'

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error')
  }

  res.status(status).json({
    success: false,
    error: { code, message: err.message || 'Something went wrong', status },
  })
}

export function createError(message, status = 400, code = 'BAD_REQUEST') {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}
