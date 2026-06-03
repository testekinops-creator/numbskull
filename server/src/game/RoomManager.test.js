import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from './RoomManager.js'

let mgr

beforeEach(() => { mgr = new RoomManager() })

describe('RoomManager', () => {
  it('creates a room with a 6-char code', async () => {
    const room = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN' })
    expect(room.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(room.phase).toBe('LOBBY')
    expect(room.players).toHaveLength(1)
  })

  it('retrieves room by id', async () => {
    const room = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN' })
    const fetched = await mgr.get(room.id)
    expect(fetched.id).toBe(room.id)
  })

  it('retrieves room by code', async () => {
    const room = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN' })
    const fetched = await mgr.getByCode(room.code)
    expect(fetched?.id).toBe(room.id)
  })

  it('generates unique codes', async () => {
    const rooms = await Promise.all(
      Array.from({ length: 20 }, (_, i) => mgr.create({ hostId: `p${i}`, hostName: `P${i}`, mode: 'GTN' }))
    )
    const codes = rooms.map(r => r.code)
    expect(new Set(codes).size).toBe(20)
  })

  it('update mutates room atomically', async () => {
    const room = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN' })
    await mgr.update(room.id, r => { r.phase = 'SETUP' })
    const updated = await mgr.get(room.id)
    expect(updated.phase).toBe('SETUP')
  })

  it('delete removes room and code', async () => {
    const room = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN' })
    await mgr.delete(room.id)
    expect(await mgr.get(room.id)).toBeNull()
    expect(await mgr.getByCode(room.code)).toBeNull()
  })

  it('listPublic returns only lobby rooms', async () => {
    const r1 = await mgr.create({ hostId: 'p1', hostName: 'Alice', mode: 'GTN', isPublic: true })
    const r2 = await mgr.create({ hostId: 'p2', hostName: 'Bob',   mode: 'BC',  isPublic: false })
    const list = mgr.listPublic()
    expect(list.find(r => r.id === r1.id)).toBeTruthy()
    expect(list.find(r => r.id === r2.id)).toBeFalsy()
  })
})
