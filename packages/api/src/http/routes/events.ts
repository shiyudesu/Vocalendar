import {
  attendeeRecordSchema,
  batchDeleteEventsRequestSchema,
  createEventRequestSchema,
  deleteEventQuerySchema,
  eventListQuerySchema,
  reminderRecordSchema,
  updateEventRequestSchema,
} from '@vocalendar/schemas'
import { Hono } from 'hono'
import { z } from 'zod'

import {
  addAttendee,
  batchDeleteEvents,
  createEventFromDraft,
  deleteEvent,
  getEvent,
  listEvents,
  removeAttendee,
  replaceEventReminders,
  sendAttendeeInvitations,
  updateAttendeeStatus,
  updateEvent,
} from '../../services/events/event.service.js'
import { draftMissingFields, notFoundWithCode, ok, validationError } from '../utils/responses.js'

type EventRouteDependencies = {
  repositories: {
    events: Parameters<typeof createEventFromDraft>[1]['eventsRepository']
    notifications: Parameters<typeof createEventFromDraft>[1]['notificationsRepository']
    realtime: Parameters<typeof createEventFromDraft>[1]['realtimeRepository']
    users: Parameters<typeof sendAttendeeInvitations>[1]['usersRepository']
  }
}

export function createEventRoutes(runtime: EventRouteDependencies) {
  const eventRoutes = new Hono()
  const dependencies = {
    eventsRepository: runtime.repositories.events,
    notificationsRepository: runtime.repositories.notifications,
    realtimeRepository: runtime.repositories.realtime,
    usersRepository: runtime.repositories.users,
  }

  eventRoutes.get('/', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const result = eventListQuerySchema.safeParse(c.req.query())

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const page = await listEvents(result.data, dependencies, currentUserId)

    return ok(c, {
      items: page.items,
      page: {
        nextCursor: page.nextCursor,
      },
    })
  })

  eventRoutes.post('/', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = createEventRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const createResult = await createEventFromDraft(
      result.data.draftId,
      dependencies,
      currentUserId,
    )

    if (!createResult.ok) {
      if (createResult.reason === 'not_found') {
        return notFoundWithCode(
          c,
          'Draft was not found.',
          { draftId: result.data.draftId },
          'DRAFT_NOT_FOUND',
        )
      }

      return draftMissingFields(c, {
        draftId: result.data.draftId,
        missingFields: createResult.missingFields,
      })
    }

    return ok(c, { event: createResult.event })
  })

  eventRoutes.post('/batch-delete', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = batchDeleteEventsRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const deletedCount = await batchDeleteEvents(result.data.eventIds, dependencies, currentUserId)

    return ok(c, { deletedCount })
  })

  eventRoutes.get('/:eventId', async (c) => {
    const event = await getEvent(
      c.req.param('eventId'),
      dependencies,
      c.get('currentUser')?.id ?? null,
    )

    if (!event) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, { event })
  })

  eventRoutes.put('/:eventId', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = updateEventRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const event = await updateEvent(
      c.req.param('eventId'),
      result.data,
      dependencies,
      currentUserId,
    )

    if (!event) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, { event })
  })

  eventRoutes.delete('/:eventId', async (c) => {
    const queryResult = deleteEventQuerySchema.safeParse(c.req.query())

    if (!queryResult.success) {
      return validationError(c, queryResult.error.flatten())
    }

    const deleted = await deleteEvent(
      c.req.param('eventId'),
      queryResult.data,
      dependencies,
      c.get('currentUser')?.id ?? null,
    )

    if (!deleted) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, { success: true })
  })

  eventRoutes.put('/:eventId/reminders', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = z
      .object({
        reminders: z.array(reminderRecordSchema),
      })
      .safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const event = await replaceEventReminders(
      c.req.param('eventId'),
      result.data.reminders,
      dependencies,
      currentUserId,
    )

    if (!event) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, { event })
  })

  eventRoutes.post('/:eventId/attendees', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = attendeeRecordSchema
      .omit({
        id: true,
        status: true,
      })
      .safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const attendee = await addAttendee(
      c.req.param('eventId'),
      result.data,
      dependencies,
      currentUserId,
    )

    if (!attendee) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, { attendee })
  })

  eventRoutes.patch('/:eventId/attendees/:attendeeId', async (c) => {
    const currentUserId = c.get('currentUser')?.id ?? null
    const body = await c.req.json().catch(() => null)
    const result = z
      .object({
        status: attendeeRecordSchema.shape.status,
      })
      .safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const attendee = await updateAttendeeStatus(
      c.req.param('eventId'),
      c.req.param('attendeeId'),
      result.data.status,
      dependencies,
      currentUserId,
    )

    if (!attendee) {
      return notFoundWithCode(c, 'Attendee was not found.', null, 'ATTENDEE_NOT_FOUND')
    }

    return ok(c, { attendee })
  })

  eventRoutes.delete('/:eventId/attendees/:attendeeId', async (c) => {
    const deleted = await removeAttendee(
      c.req.param('eventId'),
      c.req.param('attendeeId'),
      dependencies,
      c.get('currentUser')?.id ?? null,
    )

    if (!deleted) {
      return notFoundWithCode(c, 'Attendee was not found.', null, 'ATTENDEE_NOT_FOUND')
    }

    return ok(c, { success: true })
  })

  eventRoutes.post('/:eventId/attendees/invitations', async (c) => {
    const result = await sendAttendeeInvitations(
      c.req.param('eventId'),
      dependencies,
      c.get('currentUser')?.id ?? null,
    )

    if (!result) {
      return notFoundWithCode(c, 'Event was not found.', null, 'EVENT_NOT_FOUND')
    }

    return ok(c, result)
  })

  return eventRoutes
}
