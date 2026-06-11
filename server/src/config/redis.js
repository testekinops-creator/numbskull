// Optional Redis layer. Everything here is a no-op unless REDIS_URL is set, so
// local dev and single-instance deploys keep their in-memory behaviour and the
// app never hard-depends on Redis. When REDIS_URL IS set we get:
//   • room state mirrored to Redis (survives restarts/redeploys), and
//   • a Socket.IO Redis adapter (cross-instance event fan-out).
import Redis from 'ioredis'
import { logger } from '../utils/logger.js'

const url = process.env.REDIS_URL
// Guard: only treat REDIS_URL as usable if it's actually a redis(s):// URL with no
// spaces. A malformed value (e.g. someone pastes Upstash's `redis-cli --tls -u …`
// command, or the REST URL) must NEVER crash-loop the server — we log and fall
// back to in-memory. The try/catch below covers any remaining parse failures.
const looksLikeRedisUrl = /^rediss?:\/\/\S+$/.test(url || '')
export const redisEnabled = !!url && looksLikeRedisUrl
if (url && !looksLikeRedisUrl) {
  logger.warn('REDIS_URL is set but is not a valid redis:// URL — ignoring it, continuing in-memory')
}

let client = null
let pubsub = null
let broken = false   // a constructor failure → stop retrying, stay in-memory

export function getRedis() {
  if (!redisEnabled || broken) return null
  if (!client) {
    try {
      client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: true })
      client.on('error', (e) => logger.warn({ err: e.message }, 'Redis error'))
      client.on('connect', () => logger.info('Redis connected (room persistence)'))
    } catch (e) {
      broken = true; client = null
      logger.warn({ err: e.message }, 'Could not init Redis — continuing in-memory')
      return null
    }
  }
  return client
}

// Separate publisher/subscriber pair for the Socket.IO adapter.
export function getRedisPubSub() {
  if (!redisEnabled || broken) return null
  if (!pubsub) {
    try {
      const pub = new Redis(url, { maxRetriesPerRequest: null })
      const sub = pub.duplicate()
      pub.on('error', (e) => logger.warn({ err: e.message }, 'Redis pub error'))
      sub.on('error', (e) => logger.warn({ err: e.message }, 'Redis sub error'))
      pubsub = { pub, sub }
    } catch (e) {
      broken = true
      logger.warn({ err: e.message }, 'Could not init Redis pub/sub — adapter disabled')
      return null
    }
  }
  return pubsub
}
