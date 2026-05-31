import type {
  UpdateCurrentUserProfileRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  UserSettings,
} from '@vocalendar/schemas'

export type StoredUserRecord = {
  user: UserProfile
  passwordHash: string
}

export type StoredSessionRecord = {
  id: string
  userId: string
  refreshTokenHash: string
  revokedAt: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type CreateUserInput = {
  email: string
  name: string
  passwordHash: string
}

export type CreateSessionInput = {
  userId: string
  refreshTokenHash: string
  expiresAt: string
}

export type UsersRepository = {
  createUser(input: CreateUserInput): Promise<StoredUserRecord | null>
  findUserByEmail(email: string): Promise<StoredUserRecord | null>
  findUserById(userId: string): Promise<UserProfile | null>
  updateUserProfile(
    userId: string,
    input: UpdateCurrentUserProfileRequest,
  ): Promise<UserProfile | 'email_conflict' | null>
  updateUserSettings(userId: string, input: UpdateUserSettingsRequest): Promise<UserProfile | null>
  deleteUser(userId: string): Promise<boolean>
  createSession(input: CreateSessionInput): Promise<StoredSessionRecord>
  findSessionById(sessionId: string): Promise<StoredSessionRecord | null>
  replaceSessionRefreshToken(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: string,
  ): Promise<StoredSessionRecord | null>
  revokeSession(sessionId: string): Promise<boolean>
  reset(): void | Promise<void>
}

export const defaultUserSettings: UserSettings = {
  theme: 'system',
  defaultView: 'week',
  defaultReminderMinutes: 15,
  voiceFeedback: true,
  voiceSpeed: 1,
  language: 'zh-CN',
}
