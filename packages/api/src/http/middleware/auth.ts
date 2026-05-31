import type { Context, Next } from 'hono'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { createAuthService, type AuthError } from '../../services/auth/auth.service.js'
import { unauthorized } from '../utils/responses.js'

export function requireAuth(runtime: RuntimeDependencies) {
  return async (c: Context, next: Next) => {
    const token = readBearerToken(c)

    if (!token) {
      return unauthorized(c, 'Access token is required.')
    }

    const authService = createAuthService(runtime)

    try {
      const user = await authService?.getCurrentUser(token)

      c.set('currentUser', user ?? null)
      c.set('accessToken', token)

      return next()
    } catch (error) {
      const authError = error as AuthError

      return unauthorized(c, authError.message)
    }
  }
}

export function readBearerToken(c: Context) {
  const authorization = c.req.header('authorization') ?? ''
  const [scheme, token] = authorization.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}
