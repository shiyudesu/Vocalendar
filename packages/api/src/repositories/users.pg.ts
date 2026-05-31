import type {
  UpdateCurrentUserProfileRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  UserSettings,
} from '@vocalendar/schemas'

import { nowIso } from '../utils/clock.js'
import {
  defaultUserSettings,
  type StoredSessionRecord,
  type StoredUserRecord,
  type UsersRepository,
} from './users.types.js'

type DatabaseQueryLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export function createPgUsersRepository(pool: DatabaseQueryLike): UsersRepository {
  const repository = {
    async createUser(input) {
      const timestamp = nowIso()

      try {
        const result = await pool.query(
          `
            insert into users (id, email, password_hash, name, settings, created_at, updated_at)
            values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz)
            returning id, email, password_hash, name, settings, created_at, updated_at, deleted_at
          `,
          [
            `usr_${crypto.randomUUID()}`,
            normalizeEmail(input.email),
            input.passwordHash,
            input.name,
            JSON.stringify(defaultUserSettings),
            timestamp,
            timestamp,
          ],
        )

        return mapStoredUser(result.rows[0])
      } catch (error) {
        if (isUniqueViolation(error)) {
          return null
        }

        throw error
      }
    },

    async findUserByEmail(email: string) {
      const result = await pool.query(
        `
          select id, email, password_hash, name, settings, created_at, updated_at, deleted_at
          from users
          where email = $1 and deleted_at is null
        `,
        [normalizeEmail(email)],
      )

      return mapStoredUser(result.rows[0])
    },

    async findUserById(userId: string) {
      const result = await pool.query(
        `
          select id, email, password_hash, name, settings, created_at, updated_at, deleted_at
          from users
          where id = $1 and deleted_at is null
        `,
        [userId],
      )

      return mapStoredUser(result.rows[0])?.user ?? null
    },

    async updateUserProfile(userId: string, input: UpdateCurrentUserProfileRequest) {
      const current = await this.findUserById(userId)

      if (!current) {
        return null
      }

      const timestamp = nowIso()
      const nextEmail = input.email ? normalizeEmail(input.email) : current.email
      const nextName = input.name ?? current.name

      try {
        const result = await pool.query(
          `
            update users
            set email = $2, name = $3, updated_at = $4::timestamptz
            where id = $1 and deleted_at is null
            returning id, email, password_hash, name, settings, created_at, updated_at, deleted_at
          `,
          [userId, nextEmail, nextName, timestamp],
        )

        return mapStoredUser(result.rows[0])?.user ?? null
      } catch (error) {
        if (isUniqueViolation(error)) {
          return 'email_conflict'
        }

        throw error
      }
    },

    async updateUserSettings(userId: string, input: UpdateUserSettingsRequest) {
      const current = await this.findUserWithPasswordById(userId)

      if (!current) {
        return null
      }

      const nextSettings = {
        ...current.user.settings,
        ...input,
      }
      const timestamp = nowIso()
      const result = await pool.query(
        `
          update users
          set settings = $2::jsonb, updated_at = $3::timestamptz
          where id = $1 and deleted_at is null
          returning id, email, password_hash, name, settings, created_at, updated_at, deleted_at
        `,
        [userId, JSON.stringify(nextSettings), timestamp],
      )

      return mapStoredUser(result.rows[0])?.user ?? null
    },

    async deleteUser(userId: string) {
      const timestamp = nowIso()
      const deleted = await pool.query(
        `
          update users
          set deleted_at = $2::timestamptz, updated_at = $3::timestamptz
          where id = $1 and deleted_at is null
          returning id
        `,
        [userId, timestamp, timestamp],
      )

      if (deleted.rows.length === 0) {
        return false
      }

      await pool.query(
        `
          update user_sessions
          set revoked_at = $2::timestamptz, updated_at = $3::timestamptz
          where user_id = $1 and revoked_at is null
        `,
        [userId, timestamp, timestamp],
      )

      return true
    },

    async createSession(input) {
      const timestamp = nowIso()
      const result = await pool.query(
        `
          insert into user_sessions (
            id, user_id, refresh_token_hash, expires_at, created_at, updated_at
          )
          values ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::timestamptz)
          returning id, user_id, refresh_token_hash, revoked_at, expires_at, created_at, updated_at
        `,
        [
          `ses_${crypto.randomUUID()}`,
          input.userId,
          input.refreshTokenHash,
          input.expiresAt,
          timestamp,
          timestamp,
        ],
      )

      return mapSession(result.rows[0]) as StoredSessionRecord
    },

    async findSessionById(sessionId: string) {
      const result = await pool.query(
        `
          select id, user_id, refresh_token_hash, revoked_at, expires_at, created_at, updated_at
          from user_sessions
          where id = $1
        `,
        [sessionId],
      )

      return mapSession(result.rows[0])
    },

    async replaceSessionRefreshToken(
      sessionId: string,
      refreshTokenHash: string,
      expiresAt: string,
    ) {
      const timestamp = nowIso()
      const result = await pool.query(
        `
          update user_sessions
          set refresh_token_hash = $2, expires_at = $3::timestamptz, updated_at = $4::timestamptz
          where id = $1
          returning id, user_id, refresh_token_hash, revoked_at, expires_at, created_at, updated_at
        `,
        [sessionId, refreshTokenHash, expiresAt, timestamp],
      )

      return mapSession(result.rows[0])
    },

    async revokeSession(sessionId: string) {
      const timestamp = nowIso()
      const result = await pool.query(
        `
          update user_sessions
          set revoked_at = $2::timestamptz, updated_at = $3::timestamptz
          where id = $1 and revoked_at is null
          returning id
        `,
        [sessionId, timestamp, timestamp],
      )

      return result.rows.length > 0
    },

    async findUserWithPasswordById(userId: string) {
      const result = await pool.query(
        `
          select id, email, password_hash, name, settings, created_at, updated_at, deleted_at
          from users
          where id = $1 and deleted_at is null
        `,
        [userId],
      )

      return mapStoredUser(result.rows[0])
    },

    reset() {},
  } satisfies UsersRepository & {
    findUserWithPasswordById(userId: string): Promise<StoredUserRecord | null>
  }

  return repository
}

function mapStoredUser(row: Record<string, unknown> | undefined): StoredUserRecord | null {
  if (!row) {
    return null
  }

  return {
    user: mapUserProfile(row),
    passwordHash: String(row.password_hash),
  }
}

function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    settings: parseSettings(row.settings),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSession(row: Record<string, unknown> | undefined): StoredSessionRecord | null {
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    userId: String(row.user_id),
    refreshTokenHash: String(row.refresh_token_hash),
    revokedAt: nullableString(row.revoked_at),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function parseSettings(value: unknown): UserSettings {
  if (typeof value === 'string') {
    return JSON.parse(value) as UserSettings
  }

  return value as UserSettings
}

function nullableString(value: unknown) {
  return value == null ? null : String(value)
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
