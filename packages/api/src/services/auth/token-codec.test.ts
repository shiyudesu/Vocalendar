import { describe, expect, test } from 'vitest'

import { createTokenCodec } from './token-codec.js'

describe('createTokenCodec', () => {
  test('signs and verifies access and refresh tokens with token type separation', async () => {
    const codec = createTokenCodec({
      issuer: 'vocalendar',
      accessSecret: 'replace-with-a-long-random-access-secret',
      refreshSecret: 'replace-with-a-long-random-refresh-secret',
      accessTtl: '15m',
      refreshTtl: '30d',
    })

    const accessToken = await codec.signAccessToken({
      userId: 'usr_123',
      sessionId: 'ses_123',
    })
    const refreshToken = await codec.signRefreshToken({
      userId: 'usr_123',
      sessionId: 'ses_123',
    })

    const accessPayload = await codec.verifyAccessToken(accessToken)
    const refreshPayload = await codec.verifyRefreshToken(refreshToken)

    expect(accessPayload.sub).toBe('usr_123')
    expect(accessPayload.sessionId).toBe('ses_123')
    expect(accessPayload.tokenType).toBe('access')
    expect(refreshPayload.sub).toBe('usr_123')
    expect(refreshPayload.sessionId).toBe('ses_123')
    expect(refreshPayload.tokenType).toBe('refresh')

    await expect(codec.verifyAccessToken(refreshToken)).rejects.toThrowError(/tokenType/i)
    await expect(codec.verifyRefreshToken(accessToken)).rejects.toThrowError(/tokenType/i)
  })
})
