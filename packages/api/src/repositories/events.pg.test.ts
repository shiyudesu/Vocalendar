import type {
  EventRecord,
  NotificationRecord,
  V1EventDraftRecord as EventDraft,
} from '@vocalendar/schemas'
import { describe, expect, test } from 'vitest'

import {
  createPgEventsRepository,
  createPgNotificationsRepository,
  createPgRealtimeRepository,
  createPgVoiceHistoryRepository,
} from './events.pg.js'

describe('createPgEventsRepository', () => {
  test('persists drafts and events in normalized tables with user scoping', async () => {
    const state = createEventsDbState()
    const repository = createPgEventsRepository(createEventsDbStub(state))

    const draft: EventDraft = {
      draftId: 'drf_1',
      userId: 'usr_1',
      sourceText: '明天下午三点喝咖啡',
      source: 'text',
      referenceAt: '2026-05-29T02:00:00.000Z',
      normalizedText: '明天 下午三点 喝咖啡',
      parsed: {
        title: '喝咖啡',
        startAt: '2026-05-30T07:00:00.000Z',
        endAt: null,
        timezone: 'Asia/Shanghai',
        location: null,
        participants: [],
      },
      missingFields: [],
      warnings: [],
      canSave: true,
      clarificationPrompt: null,
    }

    await repository.saveDraft(draft)
    expect(await repository.findDraft(draft.draftId, 'usr_1')).toEqual(draft)
    expect(await repository.findDraft(draft.draftId, 'usr_2')).toBeNull()

    const firstEvent: EventRecord = {
      id: 'evt_1',
      userId: 'usr_1',
      title: '客户会议',
      description: null,
      startTime: '2026-05-30T08:00:00.000Z',
      endTime: '2026-05-30T09:00:00.000Z',
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: '线上会议',
      recurrence: null,
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
          status: 'pending',
        },
      ],
      priority: 'normal',
      tags: ['客户'],
      source: 'manual',
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z',
    }
    const secondEvent: EventRecord = {
      ...firstEvent,
      id: 'evt_2',
      userId: 'usr_2',
      title: '团队复盘',
      reminders: [],
      attendees: [],
      startTime: '2026-05-31T08:00:00.000Z',
    }

    await repository.saveEvent(firstEvent)
    await repository.saveEvent(secondEvent)

    expect(await repository.findEvent('evt_1', 'usr_1')).toEqual(firstEvent)
    expect(await repository.findEvent('evt_1', 'usr_2')).toBeNull()

    const firstPage = await repository.listEvents({
      userId: 'usr_1',
      cursor: null,
      limit: 10,
    })

    expect(firstPage.items).toEqual([firstEvent])
    expect(firstPage.nextCursor).toBeNull()

    const secondPage = await repository.listEvents({
      userId: 'usr_2',
      cursor: null,
      limit: 10,
    })

    expect(secondPage.items).toEqual([secondEvent])
    expect(secondPage.nextCursor).toBeNull()
    expect(await repository.countEvents('usr_1')).toBe(1)
    expect(await repository.countEvents('usr_2')).toBe(1)

    expect(await repository.deleteEvent('evt_1', 'usr_2')).toBe(false)
    expect(await repository.deleteEvent('evt_1', 'usr_1')).toBe(true)
    expect(await repository.findEvent('evt_1', 'usr_1')).toBeNull()
    expect(await repository.countEvents('usr_1')).toBe(0)
  })
})

describe('createPgNotificationsRepository', () => {
  test('creates, updates, lists, and soft deletes notifications with user scoping', async () => {
    const state = createEventsDbState()
    const repository = createPgNotificationsRepository(createEventsDbStub(state))
    const notification: NotificationRecord = {
      id: 'ntf_1',
      title: '会议提醒',
      message: '客户会议将在 15 分钟后开始',
      time: '2026-05-30T08:00:00.000Z',
      read: false,
    }

    await repository.create(notification, 'usr_1')
    expect(await repository.findById('ntf_1', 'usr_1')).toEqual(notification)
    expect(await repository.findById('ntf_1', 'usr_2')).toBeNull()

    const updated = await repository.update(
      'ntf_1',
      {
        read: true,
        time: '2026-05-30T08:10:00.000Z',
      },
      'usr_1',
    )

    expect(updated).toEqual({
      ...notification,
      read: true,
      time: '2026-05-30T08:10:00.000Z',
    })
    expect((await repository.list('usr_1')).map((item) => item.id)).toEqual(['ntf_1'])
    expect(await repository.delete('ntf_1', 'usr_2')).toBe(false)
    expect(await repository.delete('ntf_1', 'usr_1')).toBe(true)
    expect(await repository.findById('ntf_1', 'usr_1')).toBeNull()
  })
})

describe('createPgVoiceHistoryRepository', () => {
  test('stores and lists voice history in reverse chronological order per user', async () => {
    const state = createEventsDbState()
    const repository = createPgVoiceHistoryRepository(createEventsDbStub(state))

    await repository.add(
      {
        id: 'vh_1',
        kind: 'asr',
        provider: 'aliyun',
        language: 'zh-CN',
        requestSummary: { mode: 'upload' },
        resultSummary: { confidence: 0.97 },
        createdAt: '2026-05-30T08:00:00.000Z',
      },
      'usr_1',
    )
    await repository.add(
      {
        id: 'vh_2',
        kind: 'tts',
        provider: 'aliyun',
        language: 'zh-CN',
        requestSummary: { voice: 'xiaoyun' },
        resultSummary: { durationMs: 1800 },
        createdAt: '2026-05-30T09:00:00.000Z',
      },
      'usr_1',
    )
    await repository.add(
      {
        id: 'vh_3',
        kind: 'tts',
        provider: 'aliyun',
        language: 'zh-CN',
        requestSummary: {},
        resultSummary: {},
        createdAt: '2026-05-30T10:00:00.000Z',
      },
      'usr_2',
    )

    expect((await repository.list('usr_1')).map((item) => item.id)).toEqual(['vh_2', 'vh_1'])
    expect((await repository.list('usr_2')).map((item) => item.id)).toEqual(['vh_3'])
  })
})

describe('createPgRealtimeRepository', () => {
  test('persists realtime outbox items and scopes replay and subscriptions by user', async () => {
    const state = createEventsDbState()
    const pubsub = createRealtimePubSubStub()
    const repository = createPgRealtimeRepository(createEventsDbStub(state), pubsub)
    const seen: string[] = []
    const unsubscribe = await repository.subscribe((event) => seen.push(event.type), 'usr_1')

    await repository.push(
      {
        type: 'event.created',
        payload: { eventId: 'evt_1' },
        createdAt: '2026-05-30T08:00:00.000Z',
      },
      'usr_1',
    )
    await repository.push(
      {
        type: 'notification.new',
        payload: { notificationId: 'ntf_1' },
        createdAt: '2026-05-30T08:05:00.000Z',
      },
      'usr_2',
    )

    expect(seen).toEqual(['event.created'])
    expect((await repository.list('usr_1')).map((event) => event.type)).toEqual(['event.created'])
    expect((await repository.list('usr_2')).map((event) => event.type)).toEqual([
      'notification.new',
    ])

    unsubscribe()
  })
})

type EventState = {
  drafts: Map<string, EventDraft>
  events: Map<string, EventRecord & { deletedAt: string | null }>
  notifications: Map<
    string,
    NotificationRecord & {
      userId: string
      eventId: string | null
      snoozedUntil: string | null
      deletedAt: string | null
    }
  >
  voiceHistory: Array<{
    id: string
    userId: string
    kind: 'asr' | 'tts'
    provider: string
    language: string
    requestSummary: Record<string, unknown>
    resultSummary: Record<string, unknown>
    createdAt: string
  }>
  realtimeOutbox: Array<{
    id: number
    userId: string
    topic: string
    payload: unknown
    createdAt: string
  }>
}

function createEventsDbState(): EventState {
  return {
    drafts: new Map(),
    events: new Map(),
    notifications: new Map(),
    voiceHistory: [],
    realtimeOutbox: [],
  }
}

function createEventsDbStub(state: EventState) {
  return {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('insert into event_drafts')) {
        const draft = mapDraftParams(params)
        state.drafts.set(draft.draftId, draft)
        return { rows: [mapDraftRow(draft)] }
      }

      if (sql.includes('from event_drafts')) {
        const draft = state.drafts.get(String(params[0]))
        const userId = params[1] ? String(params[1]) : null

        if (!draft || (userId && draft.userId !== userId)) {
          return { rows: [] }
        }

        return { rows: [mapDraftRow(draft)] }
      }

      if (sql.includes('insert into events')) {
        const event = mapEventParams(params)
        state.events.set(event.id, event)
        return { rows: [mapEventMainRow(event)] }
      }

      if (sql.includes('delete from event_reminders')) {
        const eventId = String(params[0])
        const current = state.events.get(eventId)

        if (current) {
          current.reminders = []
        }

        return { rows: [] }
      }

      if (sql.includes('insert into event_reminders')) {
        const reminder = mapReminderParams(params)
        const current = state.events.get(reminder.eventId)

        if (current) {
          current.reminders.push(reminder)
        }

        return { rows: [] }
      }

      if (sql.includes('delete from event_attendees')) {
        const eventId = String(params[0])
        const current = state.events.get(eventId)

        if (current) {
          current.attendees = []
        }

        return { rows: [] }
      }

      if (sql.includes('insert into event_attendees')) {
        const attendee = mapAttendeeParams(params)
        const current = state.events.get(String(params[1]))

        if (current) {
          current.attendees.push(attendee)
        }

        return { rows: [] }
      }

      if (sql.includes('from events') && sql.includes('where id = $1')) {
        const event = state.events.get(String(params[0]))
        const userId = params[1] ? String(params[1]) : null

        if (!event || event.deletedAt || (userId && event.userId !== userId)) {
          return { rows: [] }
        }

        return { rows: [mapEventMainRow(event)] }
      }

      if (
        sql.includes('from events e') &&
        sql.includes('inner join event_reminders r on r.event_id = e.id')
      ) {
        const userId = params[0] ? String(params[0]) : null
        const items = [...state.events.values()]
          .filter(
            (event) =>
              !event.deletedAt &&
              event.reminders.length > 0 &&
              (!userId || event.userId === userId),
          )
          .sort((left, right) => {
            const timeOrder = left.startTime.localeCompare(right.startTime)

            if (timeOrder !== 0) {
              return timeOrder
            }

            return left.id.localeCompare(right.id)
          })

        return { rows: items.map(mapEventMainRow) }
      }

      if (sql.includes('from events') && sql.includes('order by start_time desc')) {
        const userId = params[0] ? String(params[0]) : null
        const items = [...state.events.values()]
          .filter((event) => !event.deletedAt && (!userId || event.userId === userId))
          .sort((left, right) => {
            const timeOrder = right.startTime.localeCompare(left.startTime)

            if (timeOrder !== 0) {
              return timeOrder
            }

            return right.id.localeCompare(left.id)
          })

        return { rows: items.map(mapEventMainRow) }
      }

      if (sql.includes('from event_reminders') && sql.includes('any($1')) {
        const eventIds = params[0] as string[]

        return {
          rows: eventIds.flatMap((eventId) => {
            const event = state.events.get(eventId)

            return event ? event.reminders.map(mapReminderRow) : []
          }),
        }
      }

      if (sql.includes('from event_attendees') && sql.includes('any($1')) {
        const eventIds = params[0] as string[]

        return {
          rows: eventIds.flatMap((eventId) => {
            const event = state.events.get(eventId)

            return event ? event.attendees.map((attendee) => mapAttendeeRow(eventId, attendee)) : []
          }),
        }
      }

      if (sql.includes('update events') && sql.includes('set deleted_at =')) {
        const event = state.events.get(String(params[0]))
        const userId = params[1] ? String(params[1]) : null
        const deletedAt = String(params.at(-2))

        if (!event || event.deletedAt || (userId && event.userId !== userId)) {
          return { rows: [] }
        }

        event.deletedAt = deletedAt
        event.updatedAt = String(params.at(-1))

        return { rows: [{ id: event.id }] }
      }

      if (
        sql.includes('select id') &&
        sql.includes('from events') &&
        sql.includes('deleted_at is null')
      ) {
        const userId = params[0] ? String(params[0]) : null
        const items = [...state.events.values()].filter(
          (event) => !event.deletedAt && (!userId || event.userId === userId),
        )

        return { rows: items.map((event) => ({ id: event.id })) }
      }

      if (sql.includes('insert into notifications')) {
        const notification = mapNotificationParams(params)
        state.notifications.set(notification.id, notification)
        return { rows: [mapNotificationRow(notification)] }
      }

      if (sql.includes('from notifications') && sql.includes('where id = $1')) {
        const notification = state.notifications.get(String(params[0]))
        const userId = params[1] ? String(params[1]) : null

        if (!notification || notification.deletedAt || (userId && notification.userId !== userId)) {
          return { rows: [] }
        }

        return { rows: [mapNotificationRow(notification)] }
      }

      if (sql.includes('from notifications') && sql.includes('order by time desc')) {
        const userId = params[0] ? String(params[0]) : null
        const items = [...state.notifications.values()]
          .filter(
            (notification) =>
              !notification.deletedAt && (!userId || notification.userId === userId),
          )
          .sort((left, right) => right.time.localeCompare(left.time))

        return { rows: items.map(mapNotificationRow) }
      }

      if (sql.includes('update notifications') && sql.includes('set title =')) {
        const notification = state.notifications.get(String(params[0]))
        const userId = params[6] ? String(params[6]) : null

        if (!notification || notification.deletedAt || (userId && notification.userId !== userId)) {
          return { rows: [] }
        }

        notification.title = String(params[1])
        notification.message = String(params[2])
        notification.time = String(params[3])
        notification.read = Boolean(params[4])
        notification.snoozedUntil = (params[5] as string | null) ?? null

        return { rows: [mapNotificationRow(notification)] }
      }

      if (sql.includes('update notifications') && sql.includes('set deleted_at =')) {
        const notification = state.notifications.get(String(params[0]))
        const userId = params[1] ? String(params[1]) : null

        if (!notification || notification.deletedAt || (userId && notification.userId !== userId)) {
          return { rows: [] }
        }

        notification.deletedAt = String(params[2])

        return { rows: [{ id: notification.id }] }
      }

      if (sql.includes('insert into voice_history')) {
        const item = mapVoiceHistoryParams(params)
        state.voiceHistory.push(item)
        return { rows: [mapVoiceHistoryRow(item)] }
      }

      if (sql.includes('from voice_history')) {
        const userId = String(params[0])

        return {
          rows: [...state.voiceHistory]
            .filter((item) => item.userId === userId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(mapVoiceHistoryRow),
        }
      }

      if (sql.includes('insert into realtime_outbox')) {
        const item = mapRealtimeOutboxParams(state, params)
        state.realtimeOutbox.push(item)
        return { rows: [{ id: item.id }] }
      }

      if (sql.includes('from realtime_outbox')) {
        const userId = String(params[0])

        return {
          rows: [...state.realtimeOutbox]
            .filter((item) => item.userId === userId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(mapRealtimeOutboxRow),
        }
      }

      throw new Error(`Unhandled SQL in test stub: ${sql}`)
    },
  }
}

function mapDraftParams(params: unknown[]): EventDraft {
  const [
    draftId,
    userId,
    source,
    sourceText,
    referenceAt,
    normalizedText,
    parsed,
    missingFields,
    warnings,
    canSave,
    clarificationPrompt,
  ] = params as [
    string,
    string | null,
    EventDraft['source'],
    string,
    string,
    string | undefined,
    EventDraft['parsed'],
    string[],
    string[],
    boolean,
    string | null,
  ]

  return {
    draftId,
    userId,
    source,
    sourceText,
    referenceAt,
    normalizedText,
    parsed,
    missingFields,
    warnings,
    canSave,
    clarificationPrompt,
  }
}

function mapEventParams(params: unknown[]): EventRecord & { deletedAt: string | null } {
  const [
    id,
    userId,
    title,
    description,
    startTime,
    endTime,
    allDay,
    timezone,
    location,
    recurrence,
    priority,
    tags,
    source,
    createdAt,
    updatedAt,
  ] = params as [
    string,
    string,
    string,
    string | null,
    string,
    string | null,
    boolean,
    string,
    string | null,
    string | null,
    EventRecord['priority'],
    string,
    EventRecord['source'],
    string,
    string,
  ]

  return {
    id,
    userId,
    title,
    description,
    startTime,
    endTime,
    allDay,
    timezone,
    location,
    recurrence: recurrence ? (JSON.parse(recurrence) as EventRecord['recurrence']) : null,
    reminders: [],
    attendees: [],
    priority,
    tags: JSON.parse(tags) as string[],
    source,
    createdAt,
    updatedAt,
    deletedAt: null,
  }
}

function mapReminderParams(params: unknown[]) {
  const [id, eventId, minutesBefore, method, sentAt] = params as [
    string,
    string,
    number,
    'push' | 'email' | 'sms',
    string | null,
  ]

  return {
    id,
    eventId,
    minutesBefore,
    method,
    sentAt,
  }
}

function mapAttendeeParams(params: unknown[]) {
  const [id, _eventId, name, email, status] = params as [
    string,
    string,
    string,
    string | null,
    'pending' | 'accepted' | 'declined',
  ]

  return {
    id,
    name,
    email,
    status,
  }
}

function mapNotificationParams(params: unknown[]) {
  const [id, userId, eventId, title, message, time, read, snoozedUntil] = params as [
    string,
    string,
    string | null,
    string,
    string,
    string,
    boolean,
    string | null,
  ]

  return {
    id,
    userId,
    eventId,
    title,
    message,
    time,
    read,
    snoozedUntil,
    deletedAt: null,
  }
}

function mapVoiceHistoryParams(params: unknown[]) {
  const [id, userId, kind, provider, language, requestSummary, resultSummary, createdAt] =
    params as [string, string, 'asr' | 'tts', string, string, string, string, string]

  return {
    id,
    userId,
    kind,
    provider,
    language,
    requestSummary: JSON.parse(requestSummary) as Record<string, unknown>,
    resultSummary: JSON.parse(resultSummary) as Record<string, unknown>,
    createdAt,
  }
}

function mapRealtimeOutboxParams(state: EventState, params: unknown[]) {
  const [userId, topic, payload, createdAt] = params as [string, string, string, string]

  return {
    id: state.realtimeOutbox.length + 1,
    userId,
    topic,
    payload: JSON.parse(payload) as unknown,
    createdAt,
  }
}

function mapDraftRow(draft: EventDraft) {
  return {
    id: draft.draftId,
    user_id: draft.userId,
    source: draft.source,
    source_text: draft.sourceText,
    reference_at: draft.referenceAt,
    normalized_text: draft.normalizedText,
    parsed: draft.parsed,
    missing_fields: draft.missingFields,
    warnings: draft.warnings,
    can_save: draft.canSave,
    clarification_prompt: draft.clarificationPrompt,
  }
}

function mapEventMainRow(event: EventRecord & { deletedAt: string | null }) {
  return {
    id: event.id,
    user_id: event.userId,
    title: event.title,
    description: event.description,
    start_time: event.startTime,
    end_time: event.endTime,
    all_day: event.allDay,
    timezone: event.timezone,
    location: event.location,
    recurrence: event.recurrence,
    priority: event.priority,
    tags: event.tags,
    source: event.source,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    deleted_at: event.deletedAt,
  }
}

function mapReminderRow(reminder: EventRecord['reminders'][number]) {
  return {
    id: reminder.id,
    event_id: reminder.eventId,
    minutes_before: reminder.minutesBefore,
    method: reminder.method,
    sent_at: reminder.sentAt,
  }
}

function mapAttendeeRow(eventId: string, attendee: EventRecord['attendees'][number]) {
  return {
    id: attendee.id,
    event_id: eventId,
    name: attendee.name,
    email: attendee.email,
    status: attendee.status,
  }
}

function mapNotificationRow(
  notification: NotificationRecord & {
    userId: string
    eventId: string | null
    snoozedUntil: string | null
    deletedAt: string | null
  },
) {
  return {
    id: notification.id,
    user_id: notification.userId,
    event_id: notification.eventId,
    title: notification.title,
    message: notification.message,
    time: notification.time,
    read: notification.read,
    snoozed_until: notification.snoozedUntil,
    deleted_at: notification.deletedAt,
  }
}

function mapVoiceHistoryRow(item: EventState['voiceHistory'][number]) {
  return {
    id: item.id,
    user_id: item.userId,
    kind: item.kind,
    provider: item.provider,
    language: item.language,
    request_summary: item.requestSummary,
    result_summary: item.resultSummary,
    created_at: item.createdAt,
  }
}

function mapRealtimeOutboxRow(item: EventState['realtimeOutbox'][number]) {
  return {
    id: item.id,
    user_id: item.userId,
    topic: item.topic,
    payload: item.payload,
    created_at: item.createdAt,
  }
}

function createRealtimePubSubStub() {
  const listeners = new Map<string, (message: string) => void>()

  return {
    publisher: {
      async publish(channel: string, message: string) {
        listeners.get(channel)?.(message)
      },
    },
    subscriber: {
      async subscribe(channel: string, listener: (message: string) => void) {
        listeners.set(channel, listener)
      },
      async unsubscribe(channel: string) {
        listeners.delete(channel)
      },
    },
  }
}
