const EVENT_LIMITS = {
  'game:guess':            { max: 30, windowMs: 30_000 },
  'game:ready':            { max: 10, windowMs: 30_000 },
  'game:rematch_request':  { max: 10, windowMs: 30_000 },
  'game:rematch_accept':   { max: 10, windowMs: 30_000 },
  'game:rematch_decline':  { max: 10, windowMs: 30_000 },
  'room:create':           { max: 5,  windowMs: 60_000 },
  'room:join':             { max: 10, windowMs: 60_000 },
  'room:quickmatch':       { max: 5,  windowMs: 30_000 },
  'room:reconnect':        { max: 30, windowMs: 30_000 },
  'chat:message':          { max: 20, windowMs: 10_000 },
  'chat:emoji':            { max: 40, windowMs: 10_000 },
  // New game modes (XOX / Math Battle / Sudoku)
  'match:ready':           { max: 15, windowMs: 30_000 },
  'match:forfeit':         { max: 10, windowMs: 30_000 },
  'xox:move':              { max: 60, windowMs: 30_000 },
  'math:answer':           { max: 60, windowMs: 30_000 },
  'sudoku:fill':           { max: 200, windowMs: 30_000 },
  'sudoku:lock':           { max: 200, windowMs: 30_000 },
  'sudoku:unlock':         { max: 200, windowMs: 30_000 },
  'sudoku:clear':          { max: 100, windowMs: 30_000 },
  // WebRTC voice-call signaling (ICE can be chatty)
  'call:offer':            { max: 10,  windowMs: 30_000 },
  'call:answer':           { max: 10,  windowMs: 30_000 },
  'call:ice':              { max: 400, windowMs: 30_000 },
  'call:end':              { max: 20,  windowMs: 30_000 },
  'call:decline':          { max: 10,  windowMs: 30_000 },
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
