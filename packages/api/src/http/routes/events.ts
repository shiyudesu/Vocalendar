import { createEventRequestSchema, listEventsQuerySchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import { createEventFromDraft, listRecentEvents } from '../../services/events/event.service.js'
import { draftMissingFields, notFound, ok, validationError } from '../utils/responses.js'

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

  const createResult = createEventFromDraft(result.data.draftId)

  if (!createResult.ok) {
    if (createResult.reason === 'not_found') {
      return notFound(c, 'Draft was not found.', { draftId: result.data.draftId })
    }

    return draftMissingFields(c, {
      draftId: result.data.draftId,
      missingFields: createResult.missingFields,
    })
  }

  return ok(c, { event: createResult.event })
})
