import { describe, expect, test } from 'vitest'

import { createPgUsersRepository } from './users.pg.js'

describe('createPgUsersRepository', () => {
  test('creates, reads, updates, and soft deletes users while managing sessions', async () => {
    const state = createUsersDbState()
    const repository = createPgUsersRepository(createUsersDbStub(state))

    const created = await repository.createUser({
      email: 'user@example.com',
      name: 'Vocalendar User',
      passwordHash: 'hashed-password',
    })

    expect(created?.user.email).toBe('user@example.com')
    expect(created?.passwordHash).toBe('hashed-password')

    const duplicate = await repository.createUser({
      email: 'user@example.com',
      name: 'Duplicate User',
      passwordHash: 'hash-2',
    })

    expect(duplicate).toBeNull()

    const foundByEmail = await repository.findUserByEmail('USER@example.com')

    expect(foundByEmail?.user.id).toBe(created?.user.id)

    const session = await repository.createSession({
      userId: created?.user.id as string,
      refreshTokenHash: 'refresh-hash',
      expiresAt: '2026-06-30T00:00:00.000Z',
    })

    expect(session.userId).toBe(created?.user.id)

    const refreshedSession = await repository.replaceSessionRefreshToken(
      session.id,
      'refresh-hash-2',
      '2026-07-01T00:00:00.000Z',
    )

    expect(refreshedSession?.refreshTokenHash).toBe('refresh-hash-2')

    const updatedProfile = await repository.updateUserProfile(created?.user.id as string, {
      email: 'updated@example.com',
      name: 'Updated User',
    })

    expect(updatedProfile).toEqual(
      expect.objectContaining({
        email: 'updated@example.com',
        name: 'Updated User',
      }),
    )

    const updatedSettings = await repository.updateUserSettings(created?.user.id as string, {
      theme: 'dark',
      defaultReminderMinutes: 10,
    })

    expect(updatedSettings?.settings.theme).toBe('dark')
    expect(updatedSettings?.settings.defaultReminderMinutes).toBe(10)

    const deleted = await repository.deleteUser(created?.user.id as string)

    expect(deleted).toBe(true)
    expect(await repository.findUserById(created?.user.id as string)).toBeNull()
    expect(await repository.findSessionById(session.id)).toEqual(
      expect.objectContaining({
        revokedAt: expect.any(String),
      }),
    )
  })
})

type UserRecord = {
  id: string
  email: string
  name: string
  passwordHash: string
  settings: {
    theme: 'light' | 'dark' | 'system'
    defaultView: 'day' | 'week' | 'month' | 'list'
    defaultReminderMinutes: number
    voiceFeedback: boolean
    voiceSpeed: number
    language: string
  }
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

type SessionRecord = {
  id: string
  userId: string
  refreshTokenHash: string
  revokedAt: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

function createUsersDbState() {
  return {
    users: new Map<string, UserRecord>(),
    sessions: new Map<string, SessionRecord>(),
  }
}

function createUsersDbStub(state: ReturnType<typeof createUsersDbState>) {
  return {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('insert into users')) {
        const [id, email, passwordHash, name, settings, createdAt, updatedAt] = params as [
          string,
          string,
          string,
          string,
          UserRecord['settings'],
          string,
          string,
        ]

        if ([...state.users.values()].some((user) => user.email === email && !user.deletedAt)) {
          const error = new Error('duplicate key value violates unique constraint') as Error & {
            code?: string
          }

          error.code = '23505'
          throw error
        }

        state.users.set(id, {
          id,
          email,
          name,
          passwordHash,
          settings,
          createdAt,
          updatedAt,
          deletedAt: null,
        })

        return { rows: [mapUserRow(state.users.get(id) as UserRecord)] }
      }

      if (sql.includes('from users') && sql.includes('where email = $1')) {
        const email = String(params[0])
        const user = [...state.users.values()].find((candidate) => candidate.email === email)

        return { rows: user && !user.deletedAt ? [mapUserRow(user)] : [] }
      }

      if (sql.includes('from users') && sql.includes('where id = $1')) {
        const user = state.users.get(String(params[0]))

        return { rows: user && !user.deletedAt ? [mapUserRow(user)] : [] }
      }

      if (sql.includes('update users') && sql.includes('set email = $2')) {
        const [id, email, name, updatedAt] = params as [string, string, string, string]
        const user = state.users.get(id)

        if (!user || user.deletedAt) {
          return { rows: [] }
        }

        if (
          [...state.users.values()].some(
            (candidate) => candidate.email === email && candidate.id !== id && !candidate.deletedAt,
          )
        ) {
          const error = new Error('duplicate key value violates unique constraint') as Error & {
            code?: string
          }

          error.code = '23505'
          throw error
        }

        user.email = email
        user.name = name
        user.updatedAt = updatedAt

        return { rows: [mapUserRow(user)] }
      }

      if (sql.includes('update users') && sql.includes('set settings = $2')) {
        const [id, settings, updatedAt] = params as [string, UserRecord['settings'], string]
        const user = state.users.get(id)

        if (!user || user.deletedAt) {
          return { rows: [] }
        }

        user.settings = settings
        user.updatedAt = updatedAt

        return { rows: [mapUserRow(user)] }
      }

      if (sql.includes('update users') && sql.includes('set deleted_at = $2')) {
        const [id, deletedAt, updatedAt] = params as [string, string, string]
        const user = state.users.get(id)

        if (!user || user.deletedAt) {
          return { rows: [] }
        }

        user.deletedAt = deletedAt
        user.updatedAt = updatedAt

        for (const session of state.sessions.values()) {
          if (session.userId === id && !session.revokedAt) {
            session.revokedAt = deletedAt
            session.updatedAt = updatedAt
          }
        }

        return { rows: [{ id }] }
      }

      if (sql.includes('insert into user_sessions')) {
        const [id, userId, refreshTokenHash, expiresAt, createdAt, updatedAt] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
        ]
        const session: SessionRecord = {
          id,
          userId,
          refreshTokenHash,
          revokedAt: null,
          expiresAt,
          createdAt,
          updatedAt,
        }

        state.sessions.set(id, session)

        return { rows: [mapSessionRow(session)] }
      }

      if (sql.includes('from user_sessions') && sql.includes('where id = $1')) {
        const session = state.sessions.get(String(params[0]))

        return { rows: session ? [mapSessionRow(session)] : [] }
      }

      if (sql.includes('update user_sessions') && sql.includes('set refresh_token_hash = $2')) {
        const [id, refreshTokenHash, expiresAt, updatedAt] = params as [
          string,
          string,
          string,
          string,
        ]
        const session = state.sessions.get(id)

        if (!session) {
          return { rows: [] }
        }

        session.refreshTokenHash = refreshTokenHash
        session.expiresAt = expiresAt
        session.updatedAt = updatedAt

        return { rows: [mapSessionRow(session)] }
      }

      if (sql.includes('update user_sessions') && sql.includes('set revoked_at = $2')) {
        const [id, revokedAt, updatedAt] = params as [string, string, string]
        const session = state.sessions.get(id)

        if (!session || session.revokedAt) {
          return { rows: [] }
        }

        session.revokedAt = revokedAt
        session.updatedAt = updatedAt

        return { rows: [mapSessionRow(session)] }
      }

      throw new Error(`Unhandled SQL in test stub: ${sql}`)
    },
  }
}

function mapUserRow(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    password_hash: user.passwordHash,
    settings: user.settings,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    deleted_at: user.deletedAt,
  }
}

function mapSessionRow(session: SessionRecord) {
  return {
    id: session.id,
    user_id: session.userId,
    refresh_token_hash: session.refreshTokenHash,
    revoked_at: session.revokedAt,
    expires_at: session.expiresAt,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  }
}
