// Optional Redis layer. Everything here is a no-op unless REDIS_URL is set, so
// local dev and single-instance deploys keep their in-memory behaviour and the
// app never hard-depends on Redis. When REDIS_URL IS set we get:
//   • room state mirrored to Redis (survives restarts/redeploys), and
//   • a Socket.IO Redis adapter (cross-instance event fan-out).
import Redis from 'ioredis'
import { logger } from '../utils/logger.js'

const url = process.env.REDIS_URL
export const redisEnabled = !!url

let client = null
let pubsub = null

export function getRedis() {
  if (!redisEnabled) return null
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: true })
    client.on('error', (e) => logger.warn({ err: e.message }, 'Redis error'))
    client.on('connect', () => logger.info('Redis connected (room persistence)'))
  }
  return client
}

// Separate publisher/subscriber pair for the Socket.IO adapter.
export function getRedisPubSub() {
  if (!redisEnabled) return null
  if (!pubsub) {
    const pub = new Redis(url, { maxRetriesPerRequest: null })
    const sub = pub.duplicate()
    pub.on('error', (e) => logger.warn({ err: e.message }, 'Redis pub error'))
    sub.on('error', (e) => logger.warn({ err: e.message }, 'Redis sub error'))
    pubsub = { pub, sub }
  }
  return pubsub
}
