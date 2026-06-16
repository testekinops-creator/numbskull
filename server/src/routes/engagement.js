import { Router } from 'express'
import { todaysChallenge, getDailyChallenge } from '../game/DailyChallenge.js'
import { getLeaderboard, submitScore, getPlayerRank } from '../game/Leaderboard.js'
import { getMonthly, getMonthlyRank } from '../game/MonthlyLeaderboard.js'
import { BADGES, checkBadges } from '../game/Badges.js'
import { getWeeklyQuests, claimQuest, weekSeed } from '../game/WeeklyQuests.js'
import { announcements } from './admin.js'
import { getActiveEvent, getAllEvents } from '../game/SeasonalEvents.js'
import { requireAuth } from '../middleware/auth.js'
import { AuthService } from '../services/AuthService.js'
import { prisma } from '../config/prisma.js'

export const engagementRouter = Router()

// ── Daily Challenge ────────────────────────────────────────────────────────
engagementRouter.get('/daily', (_req, res) => {
  const ch = todaysChallenge()
  res.json({ success: true, data: { date: ch.date, mode: ch.mode, range: ch.range, optimalMoves: ch.optimalMoves } })
})

engagementRouter.post('/daily/submit', (req, res) => {
  const { attempts, won, timeMs, playerId, playerName } = req.body
  const ch = todaysChallenge()
  const score = won ? Math.max(0, 1000 - (attempts - ch.optimalMoves) * 50 - Math.floor(timeMs / 1000)) : 0
  if (won && playerId) {
    submitScore({ playerId, playerName: playerName || 'Player', mode: ch.mode, score, attempts, date: ch.date })
  }
  res.json({ success: true, data: { score, date: ch.date, mode: ch.mode } })
})

// ── Monthly MULTIPLAYER leaderboard (resets each calendar month) ────────────
engagementRouter.get('/leaderboard', (_req, res) => {
  res.json({ success: true, data: getMonthly(50) })
})
engagementRouter.get('/leaderboard/rank/:id', (req, res) => {
  res.json({ success: true, data: { rank: getMonthlyRank(req.params.id) } })
})

// ── Daily-challenge leaderboard (legacy) ────────────────────────────────────
engagementRouter.get('/leaderboard/:type', (req, res) => {
  const { type } = req.params
  const { date } = req.query
  const valid = ['gtn_alltime','bc_alltime','gtn_weekly','bc_weekly','daily']
  if (!valid.includes(type)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Unknown leaderboard type', status: 400 } })
  }
  const entries = getLeaderboard(type, { date })
  res.json({ success: true, data: { type, entries } })
})

engagementRouter.get('/leaderboard/:type/rank/:playerId', (req, res) => {
  const { type, playerId } = req.params
  const rank = getPlayerRank(playerId, type)
  res.json({ success: true, data: { rank } })
})

// ── Badges ─────────────────────────────────────────────────────────────────
engagementRouter.get('/badges', (_req, res) => {
  res.json({ success: true, data: { badges: BADGES } })
})

engagementRouter.post('/badges/check', (req, res) => {
  const stats = req.body
  const earned = checkBadges(stats)
  res.json({ success: true, data: { earned } })
})

// ── Weekly Quests ──────────────────────────────────────────────────────────
engagementRouter.get('/quests', (_req, res) => {
  const quests = getWeeklyQuests()
  res.json({ success: true, data: { quests } })
})

// Claim a completed quest's XP + coins (registered users). Idempotent per
// quest-week via feature_unlocks (feature = quest_<id>_<week>). Progress is
// client-reported — same trust model as the client-tracked badges; the
// idempotency lock prevents double-claims.
engagementRouter.post('/quests/claim', requireAuth, async (req, res, next) => {
  try {
    const questId  = String(req.body?.questId || '')
    const progress = Number(req.body?.progress) || 0
    const result = claimQuest(questId, progress)
    if (!result) return res.status(400).json({ success: false, error: { code: 'NO_QUEST', message: 'Unknown quest', status: 400 } })
    if (!result.completed) return res.json({ success: true, data: { claimed: false } })

    const feature = `quest_${questId}_${weekSeed()}`
    const already = await prisma.featureUnlock.findUnique({ where: { userId_feature: { userId: req.userId, feature } } })
    if (already) return res.json({ success: true, data: { claimed: false, already: true } })

    const user  = await AuthService.getUser(req.userId)
    if (!user) return res.status(404).json({ success: false, error: { code: 'NO_USER', message: 'User not found', status: 404 } })
    const coins = Math.round(result.xp / 5)   // a small coin reward alongside the XP
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { xp: (user.xp || 0) + result.xp, coins: (user.coins || 0) + coins } }),
      prisma.featureUnlock.create({ data: { userId: req.userId, feature } }),
    ])
    res.json({ success: true, data: { claimed: true, xp: result.xp, coins, user: AuthService.publicProfile(updated) } })
  } catch (err) { next(err) }
})

// ── Announcements (public read) ────────────────────────────────────────────
engagementRouter.get('/announcements', (_req, res) => {
  res.json({ success: true, data: { announcements } })
})

// ── Seasonal Events ────────────────────────────────────────────────────────
engagementRouter.get('/seasonal', (_req, res) => {
  const active = getActiveEvent()
  res.json({ success: true, data: { active, all: getAllEvents() } })
})
