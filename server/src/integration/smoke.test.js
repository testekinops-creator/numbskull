import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../app.js'

describe('Integration Smoke Tests', () => {
  // ── Health ─────────────────────────────────────────────────────────────
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  // ── Auth ───────────────────────────────────────────────────────────────
  it('POST /api/auth/guest returns guestId', async () => {
    const res = await request(app).post('/api/auth/guest')
    expect(res.status).toBe(200)
    expect(res.body.data.guestId).toMatch(/^guest_/)
  })

  let accessToken, userId
  it('POST /api/auth/register creates account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `smoke_${Date.now()}@test.com`,
      username: `Smoke${Date.now().toString(36)}`,
      password: 'smoketest123',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.accessToken).toBeTruthy()
    accessToken = res.body.data.accessToken
    userId = res.body.data.user.id
  })

  it('GET /api/auth/me returns user with valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(userId)
  })

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  // ── Game modes ─────────────────────────────────────────────────────────
  const modes = [
    { mode: 'GTN',           action: 'guess',    body: (sid) => ({ guess: 50, sessionId: sid }) },
    { mode: 'BC',            action: 'guess',    body: (sid) => ({ guess: '1234', sessionId: sid }) },
    { mode: 'COUNTDOWN',     action: 'countdown/submit', body: (sid) => ({ expression: '1', sessionId: sid }) },
    { mode: 'NUMBER_CHAIN',  action: 'chain/move',       body: (sid) => ({ op: '+', operand: 5, sessionId: sid }) },
    { mode: 'NUMBER_TOWERS', action: 'towers/place',     body: (sid) => ({ slot: 0, sessionId: sid }) },
  ]

  for (const { mode, action, body } of modes) {
    it(`POST /api/game/start mode=${mode} returns sessionId`, async () => {
      const res = await request(app).post('/api/game/start').send({ mode })
      expect(res.status).toBe(200)
      expect(res.body.data.sessionId).toBeTruthy()
    })

    it(`POST /api/game/${action} mode=${mode} returns valid result`, async () => {
      const start = await request(app).post('/api/game/start').send({ mode })
      const sid = start.body.data.sessionId
      const res = await request(app).post(`/api/game/${action}`).send(body(sid))
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  }

  // ── Engagement ─────────────────────────────────────────────────────────
  it('GET /api/daily returns mode and date', async () => {
    const res = await request(app).get('/api/daily')
    expect(res.status).toBe(200)
    expect(['GTN','BC']).toContain(res.body.data.mode)
    expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('GET /api/leaderboard/gtn_alltime returns entries array', async () => {
    const res = await request(app).get('/api/leaderboard/gtn_alltime')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.entries)).toBe(true)
  })

  it('GET /api/badges returns 17 badges', async () => {
    const res = await request(app).get('/api/badges')
    expect(res.status).toBe(200)
    expect(res.body.data.badges).toHaveLength(17)
  })

  it('GET /api/quests returns 3 quests', async () => {
    const res = await request(app).get('/api/quests')
    expect(res.status).toBe(200)
    expect(res.body.data.quests).toHaveLength(3)
  })

  it('GET /api/seasonal returns active event or null', async () => {
    const res = await request(app).get('/api/seasonal')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /api/announcements returns array', async () => {
    const res = await request(app).get('/api/announcements')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.announcements)).toBe(true)
  })

  // ── Users ──────────────────────────────────────────────────────────────
  it('GET /api/users/:id returns public profile', async () => {
    const res = await request(app).get(`/api/users/${userId}`)
    expect(res.status).toBe(200)
    expect(res.body.data.user.id).toBe(userId)
    expect(res.body.data.user.passwordHash).toBeUndefined()
  })

  // ── Replays ────────────────────────────────────────────────────────────
  it('GET /api/replays/featured returns array', async () => {
    const res = await request(app).get('/api/replays/featured')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.replays)).toBe(true)
  })
})
