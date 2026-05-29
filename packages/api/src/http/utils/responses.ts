import type { Context } from 'hono'

import { nowIso } from '../../utils/clock.js'

export function ok<TData>(c: Context, data: TData) {
  return c.json({
    data,
    meta: {
      requestId: c.req.header('x-request-id') ?? 'dev-request',
      timestamp: nowIso(),
    },
  })
}

export function validationError(c: Context, details: unknown) {
  return c.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload is invalid.',
        details,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    400,
  )
}
