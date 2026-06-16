import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { AuthService } from '../services/AuthService.js'
import { COSMETICS, getCosmetic } from '../game/cosmetics.js'
import { levelForXp } from '../game/progression.js'

export const shopRouter = Router()

// Cosmetic ownership reuses feature_unlocks (feature = cosmetic id). Filter out
// non-cosmetic features (quest_*, etc.).
async function ownedCosmeticIds(userId) {
  const rows = await prisma.featureUnlock.findMany({ where: { userId }, select: { feature: true } })
  return rows.map(r => r.feature).filter(f => getCosmetic(f))
}

shopRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await AuthService.getUser(req.userId)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NO_USER', message: 'User not found', status: 404 } })
    res.json({ success: true, data: {
      catalog:  COSMETICS,
      owned:    await ownedCosmeticIds(req.userId),
      equipped: { frame: user.equippedFrame ?? null, title: user.equippedTitle ?? null },
      coins:    user.coins ?? 0,
      level:    levelForXp(user.xp ?? 0),
    } })
  } catch (err) { next(err) }
})

const buySchema = z.object({ id: z.string() })
shopRouter.post('/buy', requireAuth, async (req, res, next) => {
  try {
    const { id } = buySchema.parse(req.body)
    const item = getCosmetic(id)
    if (!item) return res.status(400).json({ success: false, error: { code: 'NO_ITEM', message: 'Unknown item', status: 400 } })
    const user = await AuthService.getUser(req.userId)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NO_USER', message: 'User not found', status: 404 } })

    if (levelForXp(user.xp ?? 0) < item.minLevel) {
      return res.status(400).json({ success: false, error: { code: 'LOCKED', message: `Reach level ${item.minLevel} first`, status: 400 } })
    }
    const owned = await prisma.featureUnlock.findUnique({ where: { userId_feature: { userId: req.userId, feature: id } } })
    if (owned) return res.status(400).json({ success: false, error: { code: 'OWNED', message: 'Already owned', status: 400 } })
    if ((user.coins ?? 0) < item.cost) {
      return res.status(400).json({ success: false, error: { code: 'POOR', message: 'Not enough coins', status: 400 } })
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { coins: (user.coins ?? 0) - item.cost } }),
      prisma.featureUnlock.create({ data: { userId: req.userId, feature: id } }),
    ])
    res.json({ success: true, data: { bought: id, user: AuthService.publicProfile(updated) } })
  } catch (err) { next(err) }
})

const equipSchema = z.object({ type: z.enum(['frame', 'title']), id: z.string() })
shopRouter.post('/equip', requireAuth, async (req, res, next) => {
  try {
    const { type, id } = equipSchema.parse(req.body)
    // 'default' clears the slot (frame → built-in cyan ring; title → none).
    if (id === 'default') {
      const cleared = await AuthService.updateUser(req.userId, type === 'frame' ? { equippedFrame: null } : { equippedTitle: null })
      return res.json({ success: true, data: { user: AuthService.publicProfile(cleared) } })
    }
    const item = getCosmetic(id)
    if (!item || item.type !== type) return res.status(400).json({ success: false, error: { code: 'NO_ITEM', message: 'Unknown item', status: 400 } })
    if (item.cost > 0) {
      const owned = await prisma.featureUnlock.findUnique({ where: { userId_feature: { userId: req.userId, feature: id } } })
      if (!owned) return res.status(400).json({ success: false, error: { code: 'NOT_OWNED', message: 'Buy it first', status: 400 } })
    }
    const patch = type === 'frame' ? { equippedFrame: item.value } : { equippedTitle: item.value }
    const updated = await AuthService.updateUser(req.userId, patch)
    res.json({ success: true, data: { user: AuthService.publicProfile(updated) } })
  } catch (err) { next(err) }
})
