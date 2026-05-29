import { createEventRequestSchema, listEventsQuerySchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import { createEventFromDraft, listRecentEvents } from '../../services/events/event.service.js'
import { ok, validationError } from '../utils/responses.js'

export const eventRoutes = new Hono()

eventRoutes.get('/', (c) => {
  const result = listEventsQuerySchema.safeParse(c.req.query())

  if (!result.success) {
    return validationError(c, result.error.flatten())
  }

  const events = listRecentEvents(result.data.limit)

  return ok(c, {
    items: events,
    total: events.length,
  })
})

eventRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const result = createEventRequestSchema.safeParse(body)

  if (!result.success) {
    return validationError(c, result.error.flatten())
  }

  const event = createEventFromDraft(result.data.draftId)

  if (!event) {
    return c.json(
      {
        error: {
          code: 'DRAFT_MISSING_FIELDS',
          message: 'Draft does not exist or cannot be saved.',
          details: { draftId: result.data.draftId },
        },
      },
      422,
    )
  }

  return ok(c, { event })
})
