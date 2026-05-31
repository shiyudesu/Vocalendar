import type { EventRecord } from '@vocalendar/schemas'
import { describe, expect, test } from 'vitest'

import { eventMemoryRepository } from '../../repositories/events.memory.js'
import { notificationMemoryRepository } from '../../repositories/notifications.memory.js'
import { realtimeMemoryRepository } from '../../repositories/realtime.memory.js'
import { processDueReminders } from './reminder-processor.js'

describe('processDueReminders', () => {
  test('creates a single notification when a one-off reminder becomes due and does not duplicate it', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()

    await eventMemoryRepository.saveEvent(
      buildEvent({
        id: 'evt_single',
        startTime: '2026-05-30T08:00:00.000Z',
        reminders: [
          {
            id: 'rem_single',
            eventId: 'evt_single',
            minutesBefore: 15,
            method: 'push',
            sentAt: null,
          },
        ],
      }),
    )

    await expect(
      processDueReminders(
        { now: '2026-05-30T07:40:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 0 })

    await expect(
      processDueReminders(
        { now: '2026-05-30T07:45:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 1 })

    await expect(
      processDueReminders(
        { now: '2026-05-30T07:50:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 0 })

    const notifications = await notificationMemoryRepository.list('usr_1')
    const event = await eventMemoryRepository.findEvent('evt_single', 'usr_1')

    expect(notifications).toHaveLength(1)
    expect(event?.reminders[0]?.sentAt).toBe('2026-05-30T07:45:00.000Z')
  })

  test('creates reminder notifications for each due recurring occurrence only once', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()

    await eventMemoryRepository.saveEvent(
      buildEvent({
        id: 'evt_recurring',
        startTime: '2026-05-30T08:00:00.000Z',
        recurrence: {
          frequency: 'daily',
          interval: 1,
          byWeekDay: [],
          byMonthDay: [],
          until: null,
          count: 3,
          exclusions: ['2026-05-31T08:00:00.000Z'],
        },
        reminders: [
          {
            id: 'rem_recurring',
            eventId: 'evt_recurring',
            minutesBefore: 15,
            method: 'push',
            sentAt: null,
          },
        ],
      }),
    )

    await expect(
      processDueReminders(
        { now: '2026-05-30T07:45:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 1 })

    await expect(
      processDueReminders(
        { now: '2026-05-31T07:45:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 0 })

    await expect(
      processDueReminders(
        { now: '2026-06-01T07:45:00.000Z' },
        {
          eventsRepository: eventMemoryRepository,
          notificationsRepository: notificationMemoryRepository,
          realtimeRepository: realtimeMemoryRepository,
        },
      ),
    ).resolves.toEqual({ processedCount: 1 })

    const notifications = await notificationMemoryRepository.list('usr_1')
    const event = await eventMemoryRepository.findEvent('evt_recurring', 'usr_1')

    expect(notifications).toHaveLength(2)
    expect(event?.reminders[0]?.sentAt).toBe('2026-06-01T07:45:00.000Z')
  })
})

function buildEvent(
  overrides: Partial<EventRecord> & Pick<EventRecord, 'id' | 'startTime' | 'reminders'>,
): EventRecord {
  return {
    id: overrides.id,
    userId: overrides.userId ?? 'usr_1',
    title: overrides.title ?? '客户会议',
    description: overrides.description ?? null,
    startTime: overrides.startTime,
    endTime: overrides.endTime ?? '2026-05-30T09:00:00.000Z',
    allDay: overrides.allDay ?? false,
    timezone: overrides.timezone ?? 'Asia/Shanghai',
    location: overrides.location ?? '线上会议',
    recurrence: overrides.recurrence ?? null,
    reminders: overrides.reminders,
    attendees: overrides.attendees ?? [],
    priority: overrides.priority ?? 'normal',
    tags: overrides.tags ?? [],
    source: overrides.source ?? 'manual',
    createdAt: overrides.createdAt ?? '2026-05-29T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-29T00:00:00.000Z',
  }
}
