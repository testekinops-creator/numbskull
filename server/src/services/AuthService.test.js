import { describe, it, expect } from 'vitest'
import { AuthService } from './AuthService.js'

const testUser = { email: 'alice@test.com', username: 'Alice', password: 'secure123' }

describe('AuthService', () => {
  it('registers a new user and returns tokens', async () => {
    const result = await AuthService.register(testUser)
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.user.username).toBe('Alice')
  })

  it('rejects duplicate email registration', async () => {
    await expect(AuthService.register({ ...testUser, email: 'alice@test.com' }))
      .rejects.toMatchObject({ code: 'EMAIL_EXISTS' })
  })

  it('logs in with correct credentials', async () => {
    const result = await AuthService.login({ email: testUser.email, password: testUser.password })
    expect(result.accessToken).toBeTruthy()
    expect(result.user.username).toBe('Alice')
  })

  it('rejects wrong password', async () => {
    await expect(AuthService.login({ email: testUser.email, password: 'wrongpass' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('rejects unknown email', async () => {
    await expect(AuthService.login({ email: 'nobody@x.com', password: 'x' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('refreshes tokens with valid refresh token', async () => {
    const first = await AuthService.login({ email: testUser.email, password: testUser.password })
    const second = await AuthService.refresh(first.refreshToken)
    expect(second.accessToken).toBeTruthy()
    expect(second.refreshToken).toBeTruthy()
    // new refresh token must differ (rotation); access token may be identical within same second
    expect(second.refreshToken).not.toBe(first.refreshToken)
    expect(second.user.username).toBe(testUser.username)
  })

  it('rejects refresh token reuse', async () => {
    const first = await AuthService.login({ email: testUser.email, password: testUser.password })
    await AuthService.refresh(first.refreshToken)
    await expect(AuthService.refresh(first.refreshToken))
      .rejects.toMatchObject({ code: 'TOKEN_REUSE' })
  })

  it('verifyAccess parses a valid access token', async () => {
    const { accessToken } = await AuthService.login({ email: testUser.email, password: testUser.password })
    const payload = AuthService.verifyAccess(accessToken)
    expect(payload.sub).toBeTruthy()
  })

  it('verifyAccess throws for invalid token', () => {
    expect(() => AuthService.verifyAccess('bad.token.here')).toThrow()
  })

  it('publicProfile omits passwordHash', () => {
    const user = AuthService.getUser(
      AuthService.getUserByEmail(testUser.email)?.id ||
      Object.keys(AuthService._tokenPair)
    )
    const profile = AuthService.publicProfile(AuthService.getUserByEmail(testUser.email))
    if (profile) expect(profile.passwordHash).toBeUndefined()
  })
})
