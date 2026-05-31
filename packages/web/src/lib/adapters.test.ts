import { describe, expect, test } from 'vitest'

import { toEventModel, toNotificationModel, toUserModel } from './adapters'
import type { EventRecord, NotificationRecord, UserProfile } from './api-types'

describe('adapters', () => {
  test('maps event records into UI events with Date fields', () => {
    const record: EventRecord = {
      id: 'evt_1',
      userId: 'usr_1',
      title: '客户会议',
      description: '讨论排期',
      startTime: '2026-06-01T01:00:00.000Z',
      endTime: '2026-06-01T02:00:00.000Z',
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: '国贸',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        byWeekDay: [1, 3],
        byMonthDay: [],
        until: '2026-08-01T00:00:00.000Z',
        count: 8,
        exclusions: ['2026-06-08T01:00:00.000Z'],
      },
      reminders: [
        {
          id: 'rem_1',
          eventId: 'evt_1',
          minutesBefore: 15,
          method: 'push',
          sentAt: null,
        },
      ],
      attendees: [
        {
          id: 'att_1',
          name: '张总',
          email: 'zhang@example.com',
          status: 'accepted',
        },
      ],
      priority: 'high',
      tags: ['客户'],
      source: 'manual',
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T01:00:00.000Z',
    }

    const model = toEventModel(record)

    expect(model.startTime).toBeInstanceOf(Date)
    expect(model.endTime).toBeInstanceOf(Date)
    expect(model.createdAt).toBeInstanceOf(Date)
    expect(model.updatedAt).toBeInstanceOf(Date)
    expect(model.reminders[0]?.sentAt).toBeUndefined()
    expect(model.recurrence?.until).toBeInstanceOf(Date)
    expect(model.attendees?.[0]?.email).toBe('zhang@example.com')
  })

  test('maps notification records into UI notifications', () => {
    const record: NotificationRecord = {
      id: 'ntf_1',
      title: '会议即将开始',
      message: '客户会议还有 15 分钟开始',
      time: '2026-06-01T00:45:00.000Z',
      read: false,
    }

    const model = toNotificationModel(record)

    expect(model.time).toBeInstanceOf(Date)
    expect(model.read).toBe(false)
  })

  test('maps user profiles into UI users', () => {
    const profile: UserProfile = {
      id: 'usr_1',
      name: '测试用户',
      email: 'user@example.com',
      settings: {
        theme: 'system',
        defaultView: 'week',
        defaultReminderMinutes: 15,
        voiceFeedback: true,
        voiceSpeed: 1,
        language: 'zh-CN',
      },
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T01:00:00.000Z',
    }

    const model = toUserModel(profile)

    expect(model.id).toBe('usr_1')
    expect(model.createdAt).toBeInstanceOf(Date)
    expect(model.updatedAt).toBeInstanceOf(Date)
    expect(model.settings.defaultView).toBe('week')
  })
})
