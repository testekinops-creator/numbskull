import { Router } from 'express'
import { logger } from '../utils/logger.js'

// Hands the client fresh WebRTC ICE servers (STUN + Metered TURN). The Metered
// API key stays here (server-side secret) and never ships to the browser. If
// Metered isn't configured or is unreachable, we return an empty list and the
// client falls back to its built-in public STUN + open-relay TURN.
export const turnRouter = Router()

const DOMAIN  = process.env.METERED_DOMAIN   // e.g. numbskull.metered.live
const API_KEY = process.env.METERED_API_KEY

// Cache so we don't call Metered on every voice call. Credentials are valid well
// beyond this window; we refresh comfortably inside it.
let cache = null
const CACHE_MS = 60 * 60 * 1000   // 1 hour

turnRouter.get('/', async (_req, res) => {
  // `reason`/`detail` are diagnostics only (never any secret) so we can tell why
  // the list is empty without reading server logs.
  if (!DOMAIN || !API_KEY) {
    return res.json({ success: true, data: { iceServers: [], reason: 'not-configured', has: { domain: !!DOMAIN, key: !!API_KEY } } })
  }
  if (cache && cache.expiresAt > Date.now()) {
    return res.json({ success: true, data: { iceServers: cache.iceServers } })
  }
  try {
    const url = `https://${DOMAIN.trim()}/api/v1/turn/credentials?apiKey=${encodeURIComponent(API_KEY.trim())}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Metered responded ${r.status}`)
    const body = await r.json()
    const iceServers = Array.isArray(body) ? body : (body.iceServers || [])
    cache = { iceServers, expiresAt: Date.now() + CACHE_MS }
    res.json({ success: true, data: { iceServers } })
  } catch (err) {
    logger.warn({ err: err.message }, 'TURN credentials fetch failed')
    // keyLen/domain are non-sensitive — they only reveal whether the value arrived intact.
    res.json({ success: true, data: { iceServers: [], reason: 'metered-error', detail: String(err.message).slice(0, 120), domain: DOMAIN, keyLen: API_KEY.length } })
  }
})
