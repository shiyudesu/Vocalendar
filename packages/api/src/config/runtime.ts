import { Pool } from 'pg'
import { createClient } from 'redis'

import { runPendingSqlMigrations } from '../db/migrator.js'
import { listSqlMigrationFiles, type SqlMigrationFile } from '../db/migrator.js'
import { createDeepSeekProvider } from '../integrations/llm/deepseek-provider.js'
import { createMiMoProvider } from '../integrations/llm/mimo-provider.js'
import type { LlmProvider } from '../integrations/llm/types.js'
import { createAliyunVoiceProvider } from '../integrations/voice/aliyun-provider.js'
import { mockVoiceProvider } from '../integrations/voice/mock-provider.js'
import type { VoiceProvider } from '../integrations/voice/types.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import {
  createPgEventsRepository,
  createPgNotificationsRepository,
  createPgRealtimeRepository,
  createPgVoiceHistoryRepository,
} from '../repositories/events.pg.js'
import type {
  EventsRepository,
  NotificationsRepository,
  RealtimeRepository,
  VoiceHistoryRepository,
} from '../repositories/events.types.js'
import { notificationMemoryRepository } from '../repositories/notifications.memory.js'
import { realtimeMemoryRepository } from '../repositories/realtime.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createPgUsersRepository } from '../repositories/users.pg.js'
import type { UsersRepository } from '../repositories/users.types.js'
import { voiceHistoryMemoryRepository } from '../repositories/voice-history.memory.js'
import { createTokenCodec } from '../services/auth/token-codec.js'
import {
  createReminderRuntime,
  type ReminderRuntime,
} from '../services/reminders/reminder-runtime.js'
import { loadApiEnv, type ApiEnv } from './env.js'

type EnvSource = Record<string, string | undefined>

export type DatabasePoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ name: string }> }>
  end: Pool['end']
}

export type RedisClientLike = {
  isOpen: boolean
  connect: () => Promise<unknown>
  quit: () => Promise<unknown>
  publish?: (channel: string, message: string) => Promise<unknown>
  subscribe?: (channel: string, listener: (message: string) => void) => Promise<unknown>
  unsubscribe?: (channel: string) => Promise<unknown>
}

export type DatabaseRuntime = {
  connectionString: string
  pool: DatabasePoolLike
  close: () => Promise<void>
}

export type RedisRuntime = {
  url: string
  client: RedisClientLike
  subscriber: RedisClientLike
  close: () => Promise<void>
}

export type RuntimeDependencies = {
  env: ApiEnv
  database: DatabaseRuntime
  redis: RedisRuntime
  repositories: {
    users: UsersRepository
    events: EventsRepository
    notifications: NotificationsRepository
    realtime: RealtimeRepository
    voiceHistory: VoiceHistoryRepository
  }
  voice: VoiceProvider
  llm: LlmProvider
  reminders: ReminderRuntime
  tokens: ReturnType<typeof createTokenCodec>
  migrations: SqlMigrationFile[]
  dispose: () => Promise<void>
}

export async function createRuntimeDependencies(source: EnvSource): Promise<RuntimeDependencies> {
  const env = loadApiEnv(source)
  const database = createDatabaseRuntime(env)
  const redis = createRedisRuntime(env)
  const useMemoryRepositories = env.nodeEnv === 'test'
  const repositories = {
    users: useMemoryRepositories ? userMemoryRepository : createPgUsersRepository(database.pool),
    events: useMemoryRepositories ? eventMemoryRepository : createPgEventsRepository(database.pool),
    notifications: useMemoryRepositories
      ? notificationMemoryRepository
      : createPgNotificationsRepository(database.pool),
    realtime: useMemoryRepositories
      ? realtimeMemoryRepository
      : createPgRealtimeRepository(database.pool, {
          publisher: requiredRedisPublisher(redis.client),
          subscriber: requiredRedisSubscriber(redis.subscriber),
        }),
    voiceHistory: useMemoryRepositories
      ? voiceHistoryMemoryRepository
      : createPgVoiceHistoryRepository(database.pool),
  }
  const tokens = createTokenCodec({
    issuer: 'vocalendar',
    accessSecret: env.jwt.accessSecret,
    refreshSecret: env.jwt.refreshSecret,
    accessTtl: env.jwt.accessTtl,
    refreshTtl: env.jwt.refreshTtl,
  })
  const migrations = await listSqlMigrationFiles()
  const reminders = createReminderRuntime({
    repositories,
  })

  return {
    env,
    database,
    redis,
    repositories,
    voice: env.voice.aliyun.accessKeyId.includes('your-')
      ? mockVoiceProvider
      : createAliyunVoiceProvider(env.voice.aliyun),
    llm: createLlmProvider(env),
    reminders,
    tokens,
    migrations,
    async dispose() {
      await Promise.all([database.close(), redis.close()])
    },
  }
}

export async function bootstrapRuntime(
  runtime: Pick<RuntimeDependencies, 'database' | 'redis' | 'migrations'>,
) {
  await runPendingSqlMigrations(runtime.database.pool, runtime.migrations)

  if (!runtime.redis.client.isOpen) {
    await runtime.redis.client.connect()
  }

  if (!runtime.redis.subscriber.isOpen) {
    await runtime.redis.subscriber.connect()
  }
}

function createDatabaseRuntime(env: ApiEnv): DatabaseRuntime {
  const pool = new Pool({
    connectionString: env.database.url,
    max: env.nodeEnv === 'test' ? 1 : 10,
  })

  return {
    connectionString: env.database.url,
    pool,
    async close() {
      await pool.end()
    },
  }
}

function createRedisRuntime(env: ApiEnv): RedisRuntime {
  const socketConfig = {
    reconnectStrategy: false as const,
    connectTimeout: 5000,
  }

  let clientOptions
  let displayUrl: string

  if (env.redis.url) {
    clientOptions = { url: env.redis.url, socket: socketConfig }
    displayUrl = env.redis.url
  } else if (env.redis.host && env.redis.port) {
    clientOptions = {
      socket: { ...socketConfig, host: env.redis.host, port: env.redis.port },
      password: env.redis.password,
    }
    displayUrl = `redis://${env.redis.host}:${env.redis.port}`
  } else {
    throw new Error('Redis configuration is missing: either url or host/port must be provided')
  }

  const client = createClient(clientOptions)
  const subscriber = createClient(clientOptions)

  client.on('error', (err) => {
    console.error('Redis client error:', err.message)
  })
  subscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err.message)
  })

  return {
    url: displayUrl,
    client,
    subscriber,
    async close() {
      if (client.isOpen) {
        await client.quit()
      }

      if (subscriber.isOpen) {
        await subscriber.quit()
      }
    },
  }
}

function requiredRedisPublisher(client: RedisClientLike) {
  if (!client.publish) {
    throw new Error('Redis publisher client does not support publish().')
  }

  return {
    publish: client.publish.bind(client),
  }
}

function requiredRedisSubscriber(client: RedisClientLike) {
  if (!client.subscribe || !client.unsubscribe) {
    throw new Error('Redis subscriber client does not support subscribe()/unsubscribe().')
  }

  return {
    subscribe: client.subscribe.bind(client),
    unsubscribe: client.unsubscribe.bind(client),
  }
}

// Pick the active LLM provider based on which API key is configured.
// MiMo takes precedence when its key is set, so swapping vendors is a pure
// .env change. Falls back to DeepSeek for backward compatibility.
function createLlmProvider(env: ApiEnv): LlmProvider {
  if (env.llm.mimo.apiKey) {
    return createMiMoProvider({
      apiKey: env.llm.mimo.apiKey,
      baseUrl: env.llm.mimo.baseUrl,
      model: env.llm.mimo.model,
      timeoutMs: env.llm.mimo.timeoutMs,
    })
  }

  return createDeepSeekProvider({
    apiKey: env.llm.deepseek.apiKey,
    baseUrl: env.llm.deepseek.baseUrl,
    model: env.llm.deepseek.model,
    timeoutMs: env.llm.deepseek.timeoutMs,
  })
}
