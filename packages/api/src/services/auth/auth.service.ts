import type {
  AuthLoginRequest,
  AuthRefreshRequest,
  AuthRegisterRequest,
  UpdateCurrentUserProfileRequest,
  UpdateUserSettingsRequest,
  UserProfile,
} from '@vocalendar/schemas'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { nowIso } from '../../utils/clock.js'
import { hashPassword, hashToken, verifyPassword } from './password-hasher.js'

export class AuthError extends Error {
  code: 'EMAIL_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED' | 'USER_NOT_FOUND'

  constructor(
    code: 'EMAIL_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED' | 'USER_NOT_FOUND',
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export type AuthSuccessResult = {
  user: UserProfile
  accessToken: string
  refreshToken: string
}

export function createAuthService(runtime?: RuntimeDependencies) {
  if (!runtime) {
    return null
  }

  return {
    register(input: AuthRegisterRequest) {
      return registerUser(runtime, input)
    },
    login(input: AuthLoginRequest) {
      return loginUser(runtime, input)
    },
    refresh(input: AuthRefreshRequest) {
      return refreshSession(runtime, input)
    },
    getCurrentUser(accessToken: string) {
      return getCurrentUser(runtime, accessToken)
    },
    updateCurrentUser(accessToken: string, input: UpdateCurrentUserProfileRequest) {
      return updateCurrentUser(runtime, accessToken, input)
    },
    updateCurrentUserSettings(accessToken: string, input: UpdateUserSettingsRequest) {
      return updateCurrentUserSettings(runtime, accessToken, input)
    },
    logout(accessToken: string) {
      return logoutSession(runtime, accessToken)
    },
    deleteCurrentUser(accessToken: string) {
      return deleteCurrentUser(runtime, accessToken)
    },
  }
}

async function registerUser(runtime: RuntimeDependencies, input: AuthRegisterRequest) {
  const created = await runtime.repositories.users.createUser({
    email: input.email,
    name: input.name,
    passwordHash: hashPassword(input.password),
  })

  if (!created) {
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email already exists.')
  }

  return issueSession(runtime, created.user.id, created.user)
}

async function loginUser(runtime: RuntimeDependencies, input: AuthLoginRequest) {
  const record = await runtime.repositories.users.findUserByEmail(input.email)

  if (!record || !verifyPassword(input.password, record.passwordHash)) {
    throw new AuthError('INVALID_CREDENTIALS', 'Email or password is invalid.')
  }

  return issueSession(runtime, record.user.id, record.user)
}

async function refreshSession(runtime: RuntimeDependencies, input: AuthRefreshRequest) {
  const payload = await runtime.tokens.verifyRefreshToken(input.refreshToken).catch(() => {
    throw new AuthError('UNAUTHORIZED', 'Refresh token is invalid.')
  })
  const session = await runtime.repositories.users.findSessionById(payload.sessionId)

  if (!session || session.revokedAt || session.refreshTokenHash !== hashToken(input.refreshToken)) {
    throw new AuthError('UNAUTHORIZED', 'Refresh token is invalid.')
  }

  const user = await runtime.repositories.users.findUserById(payload.sub)

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User was not found.')
  }

  const refreshToken = await runtime.tokens.signRefreshToken({
    userId: user.id,
    sessionId: session.id,
  })
  await runtime.repositories.users.replaceSessionRefreshToken(
    session.id,
    hashToken(refreshToken),
    new Date(payload.exp * 1000).toISOString(),
  )
  const accessToken = await runtime.tokens.signAccessToken({
    userId: user.id,
    sessionId: session.id,
  })

  return {
    user,
    accessToken,
    refreshToken,
  }
}

async function getCurrentUser(runtime: RuntimeDependencies, accessToken: string) {
  const payload = await runtime.tokens.verifyAccessToken(accessToken).catch(() => {
    throw new AuthError('UNAUTHORIZED', 'Access token is invalid.')
  })
  const user = await runtime.repositories.users.findUserById(payload.sub)

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User was not found.')
  }

  return user
}

async function updateCurrentUser(
  runtime: RuntimeDependencies,
  accessToken: string,
  input: UpdateCurrentUserProfileRequest,
) {
  const user = await getCurrentUser(runtime, accessToken)
  const updated = await runtime.repositories.users.updateUserProfile(user.id, input)

  if (updated === 'email_conflict') {
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email already exists.')
  }

  if (!updated) {
    throw new AuthError('USER_NOT_FOUND', 'User was not found.')
  }

  return updated
}

async function updateCurrentUserSettings(
  runtime: RuntimeDependencies,
  accessToken: string,
  input: UpdateUserSettingsRequest,
) {
  const user = await getCurrentUser(runtime, accessToken)
  const updated = await runtime.repositories.users.updateUserSettings(user.id, input)

  if (!updated) {
    throw new AuthError('USER_NOT_FOUND', 'User was not found.')
  }

  return updated
}

async function logoutSession(runtime: RuntimeDependencies, accessToken: string) {
  const payload = await runtime.tokens.verifyAccessToken(accessToken).catch(() => {
    throw new AuthError('UNAUTHORIZED', 'Access token is invalid.')
  })
  const revoked = await runtime.repositories.users.revokeSession(payload.sessionId)

  if (!revoked) {
    throw new AuthError('UNAUTHORIZED', 'Session is invalid.')
  }
}

async function deleteCurrentUser(runtime: RuntimeDependencies, accessToken: string) {
  const user = await getCurrentUser(runtime, accessToken)
  const deleted = await runtime.repositories.users.deleteUser(user.id)

  if (!deleted) {
    throw new AuthError('USER_NOT_FOUND', 'User was not found.')
  }
}

async function issueSession(
  runtime: RuntimeDependencies,
  userId: string,
  user: UserProfile,
): Promise<AuthSuccessResult> {
  const now = nowIso()
  const provisionalSession = await runtime.repositories.users.createSession({
    userId,
    refreshTokenHash: '',
    expiresAt: now,
  })
  const refreshToken = await runtime.tokens.signRefreshToken({
    userId,
    sessionId: provisionalSession.id,
  })
  const refreshPayload = await runtime.tokens.verifyRefreshToken(refreshToken)

  await runtime.repositories.users.replaceSessionRefreshToken(
    provisionalSession.id,
    hashToken(refreshToken),
    new Date(refreshPayload.exp * 1000).toISOString(),
  )
  const accessToken = await runtime.tokens.signAccessToken({
    userId,
    sessionId: provisionalSession.id,
  })

  return {
    user,
    accessToken,
    refreshToken,
  }
}
