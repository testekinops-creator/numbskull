import { Router } from 'express'
import { todaysChallenge, getDailyChallenge } from '../game/DailyChallenge.js'
import { getLeaderboard, submitScore, getPlayerRank } from '../game/Leaderboard.js'
import { BADGES, checkBadges } from '../game/Badges.js'
import { getWeeklyQuests, claimQuest } from '../game/WeeklyQuests.js'
import { announcements } from './admin.js'
import { getActiveEvent, getAllEvents } from '../game/SeasonalEvents.js'

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

// ── Leaderboard ────────────────────────────────────────────────────────────
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

// ── Announcements (public read) ────────────────────────────────────────────
engagementRouter.get('/announcements', (_req, res) => {
  res.json({ success: true, data: { announcements } })
})

// ── Seasonal Events ────────────────────────────────────────────────────────
engagementRouter.get('/seasonal', (_req, res) => {
  const active = getActiveEvent()
  res.json({ success: true, data: { active, all: getAllEvents() } })
})
