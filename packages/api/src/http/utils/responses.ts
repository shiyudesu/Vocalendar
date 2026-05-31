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

export function draftParseFailed(c: Context, details: unknown) {
  return c.json(
    {
      error: {
        code: 'DRAFT_PARSE_FAILED',
        message: 'Source text cannot be parsed into a valid draft.',
        details,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    422,
  )
}

export function notFound(c: Context, message: string, details: unknown) {
  return notFoundWithCode(c, message, details, 'NOT_FOUND')
}

export function notFoundWithCode(c: Context, message: string, details: unknown, code: string) {
  return c.json(
    {
      error: {
        code,
        message,
        details,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    404,
  )
}

export function unauthorized(c: Context, message: string, details: unknown = null) {
  const code =
    typeof details === 'object' && details && 'code' in details
      ? String((details as { code: string }).code)
      : 'UNAUTHORIZED'

  return c.json(
    {
      error: {
        code,
        message,
        details,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    401,
  )
}

export function draftMissingFields(c: Context, details: unknown) {
  return c.json(
    {
      error: {
        code: 'DRAFT_MISSING_FIELDS',
        message: 'Draft is missing required fields.',
        details,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    422,
  )
}
