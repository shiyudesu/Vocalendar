import { describe, expect, test } from 'vitest'

import { createRuntimeDependencies } from '../config/runtime.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'

const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

type AuthSuccessPayload = {
  data: {
    user: {
      id: string
      email: string
      name: string
      settings: {
        theme: string
        defaultView: string
        defaultReminderMinutes: number
        voiceFeedback: boolean
        voiceSpeed: number
        language: string
      }
      createdAt: string
      updatedAt: string
    }
    accessToken: string
    refreshToken: string
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

type MeSuccessPayload = {
  data: {
    user: {
      id: string
      email: string
      name: string
      settings: {
        theme: string
        defaultView: string
        defaultReminderMinutes: number
        voiceFeedback: boolean
        voiceSpeed: number
        language: string
      }
      createdAt: string
      updatedAt: string
    }
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

type ErrorPayload = {
  error: {
    code: string
    message: string
    details: unknown
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

describe('auth and me routes', () => {
  test('registers a user and exposes the current profile with the issued access token', async () => {
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const registerResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'strong-pass-123',
        name: 'Vocalendar User',
      }),
    })
    const registerPayload = (await registerResponse.json()) as AuthSuccessPayload

    expect(registerResponse.status).toBe(200)
    expect(registerPayload.data.user.email).toBe('user@example.com')
    expect(registerPayload.data.user.name).toBe('Vocalendar User')
    expect(registerPayload.data.user.settings.theme).toBe('system')
    expect(registerPayload.data.accessToken).toEqual(expect.any(String))
    expect(registerPayload.data.refreshToken).toEqual(expect.any(String))
    expect(registerPayload.meta.timestamp).toMatch(isoTimestampPattern)

    const meResponse = await app.request('/api/v1/me', {
      headers: {
        authorization: `Bearer ${registerPayload.data.accessToken}`,
      },
    })
    const mePayload = (await meResponse.json()) as MeSuccessPayload

    expect(meResponse.status).toBe(200)
    expect(mePayload.data.user.id).toBe(registerPayload.data.user.id)
    expect(mePayload.data.user.email).toBe('user@example.com')
    expect(mePayload.meta.timestamp).toMatch(isoTimestampPattern)
    await runtime.dispose()
  })

  test('rejects duplicate email registration and invalid login credentials', async () => {
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'strong-pass-123',
        name: 'Vocalendar User',
      }),
    })

    const duplicateResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'another-strong-pass',
        name: 'Duplicate User',
      }),
    })
    const duplicatePayload = (await duplicateResponse.json()) as ErrorPayload

    expect(duplicateResponse.status).toBe(409)
    expect(duplicatePayload.error.code).toBe('EMAIL_ALREADY_EXISTS')

    const invalidLoginResponse = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    })
    const invalidLoginPayload = (await invalidLoginResponse.json()) as ErrorPayload

    expect(invalidLoginResponse.status).toBe(401)
    expect(invalidLoginPayload.error.code).toBe('INVALID_CREDENTIALS')
    await runtime.dispose()
  })

  test('updates current user profile and settings', async () => {
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const registerResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'strong-pass-123',
        name: 'Vocalendar User',
      }),
    })
    const registerPayload = (await registerResponse.json()) as AuthSuccessPayload

    const profileResponse = await app.request('/api/v1/me', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${registerPayload.data.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Updated User',
        email: 'updated@example.com',
      }),
    })
    const profilePayload = (await profileResponse.json()) as MeSuccessPayload

    expect(profileResponse.status).toBe(200)
    expect(profilePayload.data.user.name).toBe('Updated User')
    expect(profilePayload.data.user.email).toBe('updated@example.com')

    const settingsResponse = await app.request('/api/v1/me/settings', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${registerPayload.data.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        theme: 'dark',
        defaultReminderMinutes: 10,
      }),
    })
    const settingsPayload = (await settingsResponse.json()) as MeSuccessPayload

    expect(settingsResponse.status).toBe(200)
    expect(settingsPayload.data.user.settings.theme).toBe('dark')
    expect(settingsPayload.data.user.settings.defaultReminderMinutes).toBe(10)
    await runtime.dispose()
  })

  test('refreshes a session and logout revokes the refreshed session', async () => {
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const registerResponse = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'strong-pass-123',
        name: 'Vocalendar User',
      }),
    })
    const registerPayload = (await registerResponse.json()) as AuthSuccessPayload

    const refreshResponse = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refreshToken: registerPayload.data.refreshToken,
      }),
    })
    const refreshPayload = (await refreshResponse.json()) as AuthSuccessPayload

    expect(refreshResponse.status).toBe(200)
    expect(refreshPayload.data.accessToken).not.toBe(registerPayload.data.accessToken)
    expect(refreshPayload.data.refreshToken).not.toBe(registerPayload.data.refreshToken)

    const logoutResponse = await app.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshPayload.data.accessToken}`,
      },
    })

    expect(logoutResponse.status).toBe(200)

    const refreshAfterLogoutResponse = await app.request('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refreshToken: refreshPayload.data.refreshToken,
      }),
    })
    const refreshAfterLogoutPayload = (await refreshAfterLogoutResponse.json()) as ErrorPayload

    expect(refreshAfterLogoutResponse.status).toBe(401)
    expect(refreshAfterLogoutPayload.error.code).toBe('UNAUTHORIZED')
    await runtime.dispose()
  })

  test('rejects unauthenticated current-user access', async () => {
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const response = await app.request('/api/v1/me')
    const payload = (await response.json()) as ErrorPayload

    expect(response.status).toBe(401)
    expect(payload.error.code).toBe('UNAUTHORIZED')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
    await runtime.dispose()
  })
})

const testEnv = {
  PORT: '8061',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
  JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ALIYUN_ACCESS_KEY_ID: 'akid',
  ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
  ALIYUN_NLS_APP_KEY: 'appkey',
} as const
