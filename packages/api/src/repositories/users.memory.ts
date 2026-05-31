import type {
  UpdateCurrentUserProfileRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  UserSettings,
} from '@vocalendar/schemas'

import { nowIso } from '../utils/clock.js'
import { defaultUserSettings, type UsersRepository } from './users.types.js'

type UserRecord = {
  id: string
  email: string
  name: string
  passwordHash: string
  settings: UserSettings
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

const usersById = new Map<string, UserRecord>()
const userIdsByEmail = new Map<string, string>()
const sessionsById = new Map<string, SessionRecord>()

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toUserProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    settings: user.settings,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export const userMemoryRepository: UsersRepository = {
  async createUser(input: { email: string; name: string; passwordHash: string }) {
    const normalizedEmail = normalizeEmail(input.email)

    if (userIdsByEmail.has(normalizedEmail)) {
      return null
    }

    const timestamp = nowIso()
    const user: UserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      email: normalizedEmail,
      name: input.name,
      passwordHash: input.passwordHash,
      settings: { ...defaultUserSettings },
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }

    usersById.set(user.id, user)
    userIdsByEmail.set(normalizedEmail, user.id)

    return {
      user: toUserProfile(user),
      passwordHash: user.passwordHash,
    }
  },

  async findUserByEmail(email: string) {
    const normalizedEmail = normalizeEmail(email)
    const userId = userIdsByEmail.get(normalizedEmail)

    if (!userId) {
      return null
    }

    const user = usersById.get(userId)

    if (!user || user.deletedAt) {
      return null
    }

    return {
      user: toUserProfile(user),
      passwordHash: user.passwordHash,
    }
  },

  async findUserById(userId: string) {
    const user = usersById.get(userId)

    if (!user || user.deletedAt) {
      return null
    }

    return toUserProfile(user)
  },

  async updateUserProfile(userId: string, input: UpdateCurrentUserProfileRequest) {
    const user = usersById.get(userId)

    if (!user || user.deletedAt) {
      return null
    }

    const nextEmail = input.email ? normalizeEmail(input.email) : user.email
    const ownerId = userIdsByEmail.get(nextEmail)

    if (ownerId && ownerId !== userId) {
      return 'email_conflict' as const
    }

    if (nextEmail !== user.email) {
      userIdsByEmail.delete(user.email)
      userIdsByEmail.set(nextEmail, userId)
    }

    user.email = nextEmail
    user.name = input.name ?? user.name
    user.updatedAt = nowIso()

    return toUserProfile(user)
  },

  async updateUserSettings(userId: string, input: UpdateUserSettingsRequest) {
    const user = usersById.get(userId)

    if (!user || user.deletedAt) {
      return null
    }

    user.settings = {
      ...user.settings,
      ...input,
    }
    user.updatedAt = nowIso()

    return toUserProfile(user)
  },

  async deleteUser(userId: string) {
    const user = usersById.get(userId)

    if (!user || user.deletedAt) {
      return false
    }

    user.deletedAt = nowIso()

    for (const session of sessionsById.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = nowIso()
        session.updatedAt = nowIso()
      }
    }

    return true
  },

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: string }) {
    const timestamp = nowIso()
    const session: SessionRecord = {
      id: `ses_${crypto.randomUUID()}`,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    sessionsById.set(session.id, session)

    return session
  },

  async findSessionById(sessionId: string) {
    return sessionsById.get(sessionId) ?? null
  },

  async replaceSessionRefreshToken(sessionId: string, refreshTokenHash: string, expiresAt: string) {
    const session = sessionsById.get(sessionId)

    if (!session) {
      return null
    }

    session.refreshTokenHash = refreshTokenHash
    session.expiresAt = expiresAt
    session.updatedAt = nowIso()

    return session
  },

  async revokeSession(sessionId: string) {
    const session = sessionsById.get(sessionId)

    if (!session || session.revokedAt) {
      return false
    }

    session.revokedAt = nowIso()
    session.updatedAt = nowIso()

    return true
  },

  reset() {
    usersById.clear()
    userIdsByEmail.clear()
    sessionsById.clear()
  },
}
