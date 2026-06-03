import webpush from 'web-push'
import { logger } from '../utils/logger.js'

const subscriptions = new Map()

function init() {
  const publicKey  = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email      = process.env.VAPID_EMAIL || 'mailto:admin@numbskull.app'

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey)
    logger.info('Web Push VAPID configured')
  } else {
    logger.warn('VAPID keys not set — push notifications disabled')
  }
}

init()

export const PushService = {
  subscribe(userId, subscription) {
    subscriptions.set(userId, subscription)
  },

  unsubscribe(userId) {
    subscriptions.delete(userId)
  },

  async sendToUser(userId, { title, body, url, tag }) {
    const sub = subscriptions.get(userId)
    if (!sub) return false
    try {
      await webpush.sendNotification(sub, JSON.stringify({ title, body, url, tag }))
      return true
    } catch (err) {
      if (err.statusCode === 410) this.unsubscribe(userId)
      logger.warn({ err, userId }, 'Push notification failed')
      return false
    }
  },

  async broadcast({ title, body, url, tag }) {
    const results = await Promise.allSettled(
      [...subscriptions.entries()].map(([userId]) =>
        this.sendToUser(userId, { title, body, url, tag })
      )
    )
    return results.filter(r => r.value === true).length
  },
}
