import { describe, it, expect, vi } from 'vitest'
import { socketRateLimit } from './socketRateLimit.js'

function mockSocket(id = 'sock1') {
  const emitted = []
  return { id, emit: (ev, data) => emitted.push({ ev, data }), _emitted: emitted }
}

describe('socketRateLimit', () => {
  it('allows events under the limit', () => {
    const socket = mockSocket()
    let called = 0
    for (let i = 0; i < 5; i++) {
      socketRateLimit(socket, 'game:guess', () => called++)
    }
    expect(called).toBe(5)
    expect(socket._emitted).toHaveLength(0)
  })

  it('blocks events over the limit and emits rate_limited', () => {
    const socket = mockSocket('sock2')
    let called = 0
    for (let i = 0; i < 35; i++) {
      socketRateLimit(socket, 'game:guess', () => called++)
    }
    expect(called).toBe(30)
    expect(socket._emitted.some(e => e.ev === 'error:rate_limited')).toBe(true)
  })

  it('passes unknown events through', () => {
    const socket = mockSocket('sock3')
    let called = 0
    socketRateLimit(socket, 'unknown:event', () => called++)
    expect(called).toBe(1)
  })
})
