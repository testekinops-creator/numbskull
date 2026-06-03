const EVENT_LIMITS = {
  'game:guess':        { max: 30, windowMs: 30_000 },
  'room:create':       { max: 5,  windowMs: 60_000 },
  'room:join':         { max: 10, windowMs: 60_000 },
  'room:quickmatch':   { max: 5,  windowMs: 30_000 },
  'chat:message':      { max: 20, windowMs: 10_000 },
  'chat:emoji':        { max: 40, windowMs: 10_000 },
}

const counters = new Map()

export function socketRateLimit(socket, event, next) {
  const limit = EVENT_LIMITS[event]
  if (!limit) return next()

  const key = `${socket.id}:${event}`
  const now  = Date.now()
  const data = counters.get(key) || { count: 0, resetAt: now + limit.windowMs }

  if (now > data.resetAt) {
    data.count = 0
    data.resetAt = now + limit.windowMs
  }

  data.count++
  counters.set(key, data)

  if (data.count > limit.max) {
    socket.emit('error:rate_limited', { event, retryAfter: Math.ceil((data.resetAt - now) / 1000) })
    return
  }

  next()
}

setInterval(() => {
  const now = Date.now()
  for (const [key, data] of counters) {
    if (now > data.resetAt) counters.delete(key)
  }
}, 60_000)
