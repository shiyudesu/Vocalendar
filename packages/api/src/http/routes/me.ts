import {
  updateCurrentUserProfileRequestSchema,
  updateUserSettingsRequestSchema,
} from '@vocalendar/schemas'
import type { Context } from 'hono'
import { Hono } from 'hono'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { createAuthService, AuthError } from '../../services/auth/auth.service.js'
import { nowIso } from '../../utils/clock.js'
import { notFoundWithCode, ok, unauthorized, validationError } from '../utils/responses.js'

export function createMeRoutes(runtime: RuntimeDependencies) {
  const meRoutes = new Hono()
  const authService = createAuthService(runtime)

  meRoutes.get('/', (c) => {
    const user = c.get('currentUser')

    return ok(c, { user })
  })

  meRoutes.patch('/', async (c) => {
    const accessToken = c.get('accessToken')
    const body = await c.req.json().catch(() => null)
    const result = updateCurrentUserProfileRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const user = await authService?.updateCurrentUser(accessToken, result.data)

      return ok(c, { user })
    } catch (error) {
      return mapMeError(c, error)
    }
  })

  meRoutes.patch('/settings', async (c) => {
    const accessToken = c.get('accessToken')
    const body = await c.req.json().catch(() => null)
    const result = updateUserSettingsRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const user = await authService?.updateCurrentUserSettings(accessToken, result.data)

      return ok(c, { user })
    } catch (error) {
      return mapMeError(c, error)
    }
  })

  meRoutes.delete('/', async (c) => {
    const accessToken = c.get('accessToken')

    try {
      await authService?.deleteCurrentUser(accessToken)

      return ok(c, { success: true })
    } catch (error) {
      return mapMeError(c, error)
    }
  })

  return meRoutes
}

function mapMeError(c: Context, error: unknown) {
  if (error instanceof AuthError) {
    if (error.code === 'UNAUTHORIZED') {
      return unauthorized(c, error.message, { code: error.code })
    }

    if (error.code === 'USER_NOT_FOUND') {
      return notFoundWithCode(c, error.message, null, 'USER_NOT_FOUND')
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
