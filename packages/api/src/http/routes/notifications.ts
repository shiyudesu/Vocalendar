import { Hono } from 'hono'
import { z } from 'zod'

import type { NotificationsRepository } from '../../repositories/events.types.js'
import { notFoundWithCode, ok, validationError } from '../utils/responses.js'

const updateNotificationSchema = z.object({
  read: z.boolean(),
})

const snoozeNotificationSchema = z.object({
  minutes: z.number().int().min(1),
})

type NotificationRouteDependencies = {
  repositories: {
    notifications: NotificationsRepository
  }
}

export function createNotificationRoutes(runtime: NotificationRouteDependencies) {
  const notificationRoutes = new Hono()

  notificationRoutes.get('/', async (c) => {
    return ok(c, {
      items: await runtime.repositories.notifications.list(c.get('currentUser')?.id ?? null),
    })
  })

  notificationRoutes.patch('/:notificationId', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = updateNotificationSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const notification = await runtime.repositories.notifications.update(
      c.req.param('notificationId'),
      result.data,
      c.get('currentUser')?.id ?? null,
    )

    if (!notification) {
      return notFoundWithCode(c, 'Notification was not found.', null, 'NOTIFICATION_NOT_FOUND')
    }

    return ok(c, { notification })
  })

  notificationRoutes.delete('/:notificationId', async (c) => {
    const deleted = await runtime.repositories.notifications.delete(
      c.req.param('notificationId'),
      c.get('currentUser')?.id ?? null,
    )

    if (!deleted) {
      return notFoundWithCode(c, 'Notification was not found.', null, 'NOTIFICATION_NOT_FOUND')
    }

    return ok(c, { success: true })
  })

  notificationRoutes.post('/:notificationId/snooze', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = snoozeNotificationSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const current = await runtime.repositories.notifications.findById(
      c.req.param('notificationId'),
      c.get('currentUser')?.id ?? null,
    )

    if (!current) {
      return notFoundWithCode(c, 'Notification was not found.', null, 'NOTIFICATION_NOT_FOUND')
    }

    const notification = await runtime.repositories.notifications.update(
      c.req.param('notificationId'),
      {
        time: new Date(
          new Date(current.time).getTime() + result.data.minutes * 60_000,
        ).toISOString(),
      },
      c.get('currentUser')?.id ?? null,
    )

    return ok(c, { notification })
  })

  return notificationRoutes
}
