import type { NotificationRecord } from '@vocalendar/schemas'

import type { NotificationsRepository } from './events.types.js'

type StoredNotification = {
  record: NotificationRecord
  userId: string | null
}

const notifications = new Map<string, StoredNotification>()

export const notificationMemoryRepository: NotificationsRepository = {
  async list(userId?: string | null) {
    return [...notifications.values()]
      .filter((notification) => !userId || notification.userId === userId)
      .map((notification) => notification.record)
      .sort((left, right) => right.time.localeCompare(left.time))
  },

  async findById(notificationId: string, userId?: string | null) {
    const notification = notifications.get(notificationId) ?? null

    if (!notification) {
      return null
    }

    if (userId && notification.userId !== userId) {
      return null
    }

    return notification.record
  },

  async create(notification: NotificationRecord, userId?: string | null) {
    notifications.set(notification.id, {
      record: notification,
      userId: userId ?? null,
    })
    return notification
  },

  async update(notificationId: string, input: Partial<NotificationRecord>, userId?: string | null) {
    const current = notifications.get(notificationId)

    if (!current) {
      return null
    }

    if (userId && current.userId !== userId) {
      return null
    }

    const updated: NotificationRecord = {
      ...current.record,
      ...input,
    }

    notifications.set(notificationId, {
      ...current,
      record: updated,
    })

    return updated
  },

  async delete(notificationId: string, userId?: string | null) {
    const current = notifications.get(notificationId)

    if (!current) {
      return false
    }

    if (userId && current.userId !== userId) {
      return false
    }

    return notifications.delete(notificationId)
  },

  reset() {
    notifications.clear()
  },
}
