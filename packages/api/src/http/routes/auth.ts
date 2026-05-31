import {
  authLoginRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
} from '@vocalendar/schemas'
import type { Context } from 'hono'
import { Hono } from 'hono'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { createAuthService, AuthError } from '../../services/auth/auth.service.js'
import { nowIso } from '../../utils/clock.js'
import { ok, unauthorized, validationError } from '../utils/responses.js'

export function createAuthRoutes(runtime: RuntimeDependencies) {
  const authRoutes = new Hono()
  const authService = createAuthService(runtime)

  authRoutes.post('/register', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = authRegisterRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const session = await authService?.register(result.data)

      return ok(c, session)
    } catch (error) {
      return mapAuthError(c, error)
    }
  })

  authRoutes.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = authLoginRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const session = await authService?.login(result.data)

      return ok(c, session)
    } catch (error) {
      return mapAuthError(c, error)
    }
  })

  authRoutes.post('/refresh', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = authRefreshRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const session = await authService?.refresh(result.data)

      return ok(c, session)
    } catch (error) {
      return mapAuthError(c, error)
    }
  })

  authRoutes.post('/logout', async (c) => {
    const accessToken = c.get('accessToken')

    try {
      await authService?.logout(accessToken)

      return ok(c, { success: true })
    } catch (error) {
      return mapAuthError(c, error)
    }
  })

  return authRoutes
}

function mapAuthError(c: Context, error: unknown) {
  if (error instanceof AuthError) {
    if (error.code === 'INVALID_CREDENTIALS' || error.code === 'UNAUTHORIZED') {
      return unauthorized(c, error.message, { code: error.code })
    }

    if (error.code === 'EMAIL_ALREADY_EXISTS') {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: null,
          },
          meta: {
            requestId: c.req.header('x-request-id') ?? 'dev-request',
            timestamp: nowIso(),
          },
        },
        409,
      )
    }
  }

  throw error
}
