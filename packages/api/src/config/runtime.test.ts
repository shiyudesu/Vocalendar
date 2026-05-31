import { describe, expect, test } from 'vitest'

import { eventMemoryRepository } from '../repositories/events.memory.js'
import { notificationMemoryRepository } from '../repositories/notifications.memory.js'
import { realtimeMemoryRepository } from '../repositories/realtime.memory.js'
import { voiceHistoryMemoryRepository } from '../repositories/voice-history.memory.js'
import { bootstrapRuntime, createRuntimeDependencies } from './runtime.js'

describe('createRuntimeDependencies', () => {
  test('assembles env, migrations, database, redis, and token services from env source', async () => {
    const runtime = await createRuntimeDependencies({
      PORT: '8062',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
      REDIS_URL: 'redis://127.0.0.1:6379',
      JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
      JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
      JWT_ACCESS_TTL: '20m',
      JWT_REFRESH_TTL: '45d',
      ALIYUN_ACCESS_KEY_ID: 'akid',
      ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
      ALIYUN_NLS_APP_KEY: 'appkey',
    })

    expect(runtime.env.port).toBe(8062)
    expect(runtime.env.nodeEnv).toBe('test')
    expect(runtime.database.connectionString).toBe(
      'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
    )
    expect(runtime.database.pool).toBeDefined()
    expect(runtime.redis.url).toBe('redis://127.0.0.1:6379')
    expect(runtime.redis.client).toBeDefined()
    expect(runtime.redis.subscriber).toBeDefined()
    expect(runtime.migrations[0]?.name).toBe('0001_phase1_foundation.sql')
    expect(runtime.repositories.users).toBeDefined()
    expect(runtime.repositories.events).toBeDefined()
    expect(runtime.repositories.notifications).toBeDefined()
    expect(runtime.repositories.realtime).toBeDefined()
    expect(runtime.repositories.voiceHistory).toBeDefined()
    expect(runtime.reminders.processDue).toEqual(expect.any(Function))
    expect(runtime.reminders.startPolling).toEqual(expect.any(Function))

    const accessToken = await runtime.tokens.signAccessToken({
      userId: 'usr_123',
      sessionId: 'ses_123',
    })
    const accessPayload = await runtime.tokens.verifyAccessToken(accessToken)

    expect(accessPayload.sub).toBe('usr_123')
    expect(accessPayload.sessionId).toBe('ses_123')
    expect(accessPayload.tokenType).toBe('access')

    await runtime.dispose()
  })

  test('bootstraps runtime by running pending migrations and opening the redis client', async () => {
    const executedStatements: string[] = []
    let connected = false
    let subscriberConnected = false

    await bootstrapRuntime({
      migrations: [
        {
          name: '0001_phase1_foundation.sql',
          path: '/tmp/0001.sql',
          sql: 'select 1;',
        },
      ],
      database: {
        connectionString: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
        pool: {
          async query(sql: string, params?: unknown[]) {
            executedStatements.push(sql)

            if (sql.includes('select name from schema_migrations')) {
              return { rows: [] }
            }

            if (sql.startsWith('insert into schema_migrations')) {
              executedStatements.push(`insert:${String(params?.[0])}`)
            }

            return { rows: [] }
          },
          async end() {},
        },
        async close() {},
      },
      redis: {
        url: 'redis://127.0.0.1:6379',
        client: {
          isOpen: false,
          async connect() {
            connected = true
          },
          async quit() {
            connected = false
          },
        },
        subscriber: {
          isOpen: false,
          async connect() {
            subscriberConnected = true
          },
          async quit() {
            subscriberConnected = false
          },
        },
        async close() {},
      },
    })

    expect(connected).toBe(true)
    expect(subscriberConnected).toBe(true)
    expect(executedStatements.some((statement) => statement.includes('schema_migrations'))).toBe(
      true,
    )
    expect(executedStatements).toContain('select 1;')
    expect(executedStatements).toContain('insert:0001_phase1_foundation.sql')
  })

  test('uses Postgres-backed repositories outside test mode', async () => {
    const runtime = await createRuntimeDependencies({
      PORT: '8061',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
      REDIS_URL: 'redis://127.0.0.1:6379',
      JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
      JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
      ALIYUN_ACCESS_KEY_ID: 'akid',
      ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
      ALIYUN_NLS_APP_KEY: 'appkey',
    })

    expect(runtime.repositories.events).not.toBe(eventMemoryRepository)
    expect(runtime.repositories.notifications).not.toBe(notificationMemoryRepository)
    expect(runtime.repositories.realtime).not.toBe(realtimeMemoryRepository)
    expect(runtime.repositories.voiceHistory).not.toBe(voiceHistoryMemoryRepository)

    await runtime.dispose()
  })
})
