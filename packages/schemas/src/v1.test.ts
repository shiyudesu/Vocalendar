import { describe, expect, test } from 'vitest'

import {
  authLoginRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema,
  deleteEventQuerySchema,
  eventListQuerySchema,
  eventRecordSchema,
  notificationRecordSchema,
  recurrenceRuleSchema,
  updateEventRequestSchema,
  updateCurrentUserProfileRequestSchema,
  updateUserSettingsRequestSchema,
  userProfileSchema,
  voiceAsrWsStartMessageSchema,
} from './v1/index.js'

describe('schemas v1', () => {
  test('accepts target-state event records with recurrence, reminders, and attendees', () => {
    const result = eventRecordSchema.safeParse({
      id: 'evt_123',
      userId: 'usr_123',
      title: '客户会议',
      description: null,
      startTime: '2026-06-01T02:00:00.000Z',
      endTime: '2026-06-01T03:00:00.000Z',
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: '国贸三期',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        byWeekDay: [1, 3, 5],
        byMonthDay: [],
        until: null,
        count: null,
        exclusions: [],
      },
      reminders: [
        {
          id: 'rem_123',
          eventId: 'evt_123',
          minutesBefore: 15,
          method: 'push',
          sentAt: null,
        },
      ],
      attendees: [
        {
          id: 'att_123',
          name: '张总',
          email: 'zhang@example.com',
          status: 'pending',
        },
      ],
      priority: 'high',
      tags: ['客户'],
      source: 'voice',
      createdAt: '2026-05-30T10:00:00.000Z',
      updatedAt: '2026-05-30T10:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })

  test('defaults cursor-based event list queries and rejects offset pagination', () => {
    const parsed = eventListQuerySchema.parse({})

    expect(parsed).toEqual({
      cursor: null,
      limit: 20,
      keyword: null,
      priority: null,
      source: null,
      startDate: null,
      endDate: null,
      timezone: null,
    })

    const legacy = eventListQuerySchema.safeParse({
      offset: 10,
    })

    expect(legacy.success).toBe(false)
  })

  test('accepts recurrence rules and user settings updates defined by the v1 contract', () => {
    const recurrence = recurrenceRuleSchema.safeParse({
      frequency: 'monthly',
      interval: 1,
      byWeekDay: [],
      byMonthDay: [1, 15],
      until: '2026-12-31T00:00:00.000Z',
      count: null,
      exclusions: [],
    })

    expect(recurrence.success).toBe(true)

    const settings = updateUserSettingsRequestSchema.safeParse({
      theme: 'dark',
      defaultView: 'week',
      defaultReminderMinutes: 10,
      voiceFeedback: true,
      voiceSpeed: 1.1,
      language: 'zh-CN',
    })

    expect(settings.success).toBe(true)
  })

  test('validates auth registration, notification records, and realtime ASR session start payloads', () => {
    const register = authRegisterRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'strong-pass-123',
      name: 'Vocalendar User',
    })

    expect(register.success).toBe(true)

    const notification = notificationRecordSchema.safeParse({
      id: 'ntf_123',
      title: '会议提醒',
      message: '客户会议将在 15 分钟后开始',
      time: '2026-06-01T01:45:00.000Z',
      read: false,
    })

    expect(notification.success).toBe(true)

    const wsStart = voiceAsrWsStartMessageSchema.safeParse({
      type: 'session.start',
      audioFormat: 'pcm',
      sampleRate: 16000,
      language: 'zh-CN',
      enableIntermediateResult: true,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
    })

    expect(wsStart.success).toBe(true)
  })

  test('accepts auth login/refresh payloads and current-user profile shapes', () => {
    const login = authLoginRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'strong-pass-123',
    })

    expect(login.success).toBe(true)

    const refresh = authRefreshRequestSchema.safeParse({
      refreshToken: 'refresh-token',
    })

    expect(refresh.success).toBe(true)

    const profile = userProfileSchema.safeParse({
      id: 'usr_123',
      email: 'user@example.com',
      name: 'Vocalendar User',
      settings: {
        theme: 'system',
        defaultView: 'week',
        defaultReminderMinutes: 15,
        voiceFeedback: true,
        voiceSpeed: 1,
        language: 'zh-CN',
      },
      createdAt: '2026-05-30T10:00:00.000Z',
      updatedAt: '2026-05-30T10:00:00.000Z',
    })

    expect(profile.success).toBe(true)

    const updateProfile = updateCurrentUserProfileRequestSchema.safeParse({
      name: 'Updated User',
      email: 'updated@example.com',
    })

    expect(updateProfile.success).toBe(true)
  })

  test('requires occurrenceStartTime for scoped recurring event updates and deletes', () => {
    const scopedUpdate = updateEventRequestSchema.safeParse({
      title: '后续项目例会',
      description: null,
      startTime: '2026-06-05T09:30:00.000Z',
      endTime: '2026-06-05T10:30:00.000Z',
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: '项目会议室',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        byWeekDay: [1, 3, 5],
        byMonthDay: [],
        until: null,
        count: 4,
        exclusions: [],
      },
      reminders: [],
      attendees: [],
      priority: 'normal',
      tags: ['项目'],
      source: 'manual',
      recurrenceScope: 'following',
    })

    expect(scopedUpdate.success).toBe(false)

    const scopedDelete = deleteEventQuerySchema.safeParse({
      recurrenceScope: 'single',
    })

    expect(scopedDelete.success).toBe(false)
  })
})
