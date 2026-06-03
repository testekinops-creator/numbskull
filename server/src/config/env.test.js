import { describe, it, expect, vi } from 'vitest'

describe('env validation', () => {
  it('accepts valid env', async () => {
    vi.stubEnv('JWT_ACCESS_SECRET',  'a_secret_that_is_long_enough_abc')
    vi.stubEnv('JWT_REFRESH_SECRET', 'r_secret_that_is_long_enough_xyz')
    vi.stubEnv('NODE_ENV', 'test')
    const { env } = await import('./env.js')
    expect(env).toBeTruthy()
    vi.unstubAllEnvs()
  })
})
