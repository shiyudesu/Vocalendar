import { describe, expect, test } from 'vitest'

import { loadApiEnv } from './env.js'

describe('loadApiEnv', () => {
  test('parses config with defaults for port, export dir, and aliyun regions', () => {
    const env = loadApiEnv({
      DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
      REDIS_URL: 'redis://127.0.0.1:6379',
      JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
      JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
      ALIYUN_ACCESS_KEY_ID: 'akid',
      ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
      ALIYUN_NLS_APP_KEY: 'appkey',
    })

    expect(env.port).toBe(8061)
    expect(env.nodeEnv).toBe('development')
    expect(env.jwt.accessTtl).toBe('15m')
    expect(env.jwt.refreshTtl).toBe('30d')
    expect(env.voice.aliyun.asrRegion).toBe('cn-shanghai')
    expect(env.voice.aliyun.ttsRegion).toBe('cn-shanghai')
    expect(env.export.tempDir).toBe('/tmp/vocalendar-export')
  })

  test('rejects invalid urls and missing jwt secrets', () => {
    expect(() =>
      loadApiEnv({
        DATABASE_URL: 'not-a-url',
        REDIS_URL: 'redis://127.0.0.1:6379',
        JWT_ACCESS_SECRET: '',
        JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
        ALIYUN_ACCESS_KEY_ID: 'akid',
        ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
        ALIYUN_NLS_APP_KEY: 'appkey',
      }),
    ).toThrowError(/DATABASE_URL/i)

    expect(() =>
      loadApiEnv({
        DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
        REDIS_URL: 'redis://127.0.0.1:6379',
        JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
        ALIYUN_ACCESS_KEY_ID: 'akid',
        ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
        ALIYUN_NLS_APP_KEY: 'appkey',
      }),
    ).toThrowError(/JWT_REFRESH_SECRET/i)
  })
})
