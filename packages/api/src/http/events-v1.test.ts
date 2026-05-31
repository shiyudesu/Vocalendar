import { describe, expect, test } from 'vitest'

import { createRuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'

type AuthPayload = {
  data: {
    accessToken: string
    user: {
      id: string
    }
  }
}

type EventPayload = {
  data: {
    event: {
      id: string
      userId: string
      title: string
      startTime: string
      endTime: string | null
      timezone: string
      recurrence?: {
        frequency: string
        count?: number | null
        exclusions?: string[]
      } | null
      reminders: Array<{
        minutesBefore: number
      }>
      attendees: Array<{
        name: string
      }>
      source: string
      priority: string
    }
  }
}

type EventListPayload = {
  data: {
    items: Array<{
      id: string
      title: string
      startTime: string
    }>
    page: {
      nextCursor: string | null
    }
  }
}

type ErrorPayload = {
  error: {
    code: string
  }
}

describe('events v1 routes', () => {
  test('requires auth and scopes runtime-backed event access to the current user', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const unauthorizedResponse = await app.request('/api/v1/events?limit=10')
    const unauthorizedPayload = (await unauthorizedResponse.json()) as ErrorPayload

    expect(unauthorizedResponse.status).toBe(401)
    expect(unauthorizedPayload.error.code).toBe('UNAUTHORIZED')

    const firstAuth = await registerAndGetAccessToken(app, 'events-scope-1@example.com')
    const secondAuth = await registerAndGetAccessToken(app, 'events-scope-2@example.com')
    const firstEventId = await createEvent(app, firstAuth.accessToken)
    const secondEventId = await createEvent(app, secondAuth.accessToken)

    const firstListResponse = await app.request('/api/v1/events?limit=10', {
      headers: {
        authorization: `Bearer ${firstAuth.accessToken}`,
      },
    })
    const firstListPayload = (await firstListResponse.json()) as EventListPayload

    expect(firstListResponse.status).toBe(200)
    expect(firstListPayload.data.items.map((item) => item.id)).toEqual([firstEventId])

    const secondListResponse = await app.request('/api/v1/events?limit=10', {
      headers: {
        authorization: `Bearer ${secondAuth.accessToken}`,
      },
    })
    const secondListPayload = (await secondListResponse.json()) as EventListPayload

    expect(secondListResponse.status).toBe(200)
    expect(secondListPayload.data.items.map((item) => item.id)).toEqual([secondEventId])

    const crossUserResponse = await app.request(`/api/v1/events/${secondEventId}`, {
      headers: {
        authorization: `Bearer ${firstAuth.accessToken}`,
      },
    })
    const crossUserPayload = (await crossUserResponse.json()) as ErrorPayload

    expect(crossUserResponse.status).toBe(404)
    expect(crossUserPayload.error.code).toBe('EVENT_NOT_FOUND')

    await runtime.dispose()
  })

  test('creates, fetches, updates, lists, and deletes events using v1 field names', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const auth = await registerAndGetAccessToken(app, 'events@example.com')
    const accessToken = auth.accessToken

    const draftResponse = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sourceText: '明天下午三点和张总在国贸喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'voice',
      }),
    })
    const draftPayload = (await draftResponse.json()) as {
      data: { draft: { draftId: string } }
    }

    const createResponse = await app.request('/api/v1/events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        draftId: draftPayload.data.draft.draftId,
      }),
    })
    const createPayload = (await createResponse.json()) as EventPayload

    expect(createResponse.status).toBe(200)
    expect(createPayload.data.event.userId).toBe(auth.userId)
    expect(createPayload.data.event.startTime).toBe('2026-05-30T07:00:00.000Z')
    expect(createPayload.data.event.source).toBe('voice')
    expect(createPayload.data.event.priority).toBe('normal')
    expect(createPayload.data.event.reminders).toHaveLength(1)
    expect(createPayload.data.event.reminders[0]?.minutesBefore).toBe(15)
    expect(createPayload.data.event.attendees).toEqual([])

    const detailResponse = await app.request(`/api/v1/events/${createPayload.data.event.id}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const detailPayload = (await detailResponse.json()) as EventPayload

    expect(detailResponse.status).toBe(200)
    expect(detailPayload.data.event.id).toBe(createPayload.data.event.id)
    expect(detailPayload.data.event.userId).toBe(auth.userId)
    expect(detailPayload.data.event.startTime).toBe('2026-05-30T07:00:00.000Z')

    const updateResponse = await app.request(`/api/v1/events/${createPayload.data.event.id}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '客户会议',
        description: '更新后的描述',
        startTime: '2026-05-30T08:00:00.000Z',
        endTime: '2026-05-30T09:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '线上腾讯会议',
        recurrence: null,
        reminders: [
          {
            id: 'rem_custom',
            eventId: createPayload.data.event.id,
            minutesBefore: 30,
            method: 'push',
            sentAt: null,
          },
        ],
        attendees: [
          {
            id: 'att_custom',
            name: '张总',
            email: 'zhang@example.com',
            status: 'accepted',
          },
        ],
        priority: 'high',
        tags: ['客户'],
        source: 'manual',
      }),
    })
    const updatePayload = (await updateResponse.json()) as EventPayload

    expect(updateResponse.status).toBe(200)
    expect(updatePayload.data.event.title).toBe('客户会议')
    expect(updatePayload.data.event.startTime).toBe('2026-05-30T08:00:00.000Z')
    expect(updatePayload.data.event.reminders[0]?.minutesBefore).toBe(30)
    expect(updatePayload.data.event.attendees[0]?.name).toBe('张总')
    expect(updatePayload.data.event.source).toBe('manual')

    const listResponse = await app.request('/api/v1/events?limit=10', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const listPayload = (await listResponse.json()) as EventListPayload

    expect(listResponse.status).toBe(200)
    expect(listPayload.data.items).toHaveLength(1)
    expect(listPayload.data.items[0]?.title).toBe('客户会议')
    expect(listPayload.data.page.nextCursor).toBeNull()

    const deleteResponse = await app.request(`/api/v1/events/${createPayload.data.event.id}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(deleteResponse.status).toBe(200)

    const missingDetailResponse = await app.request(
      `/api/v1/events/${createPayload.data.event.id}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      },
    )
    const missingDetailPayload = (await missingDetailResponse.json()) as ErrorPayload

    expect(missingDetailResponse.status).toBe(404)
    expect(missingDetailPayload.error.code).toBe('EVENT_NOT_FOUND')

    await runtime.dispose()
  })

  test('applies the user default reminder setting when creating a new event', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const auth = await registerAndGetAccessToken(app, 'events-default-reminder@example.com')

    const settingsResponse = await app.request('/api/v1/me/settings', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        defaultReminderMinutes: 30,
      }),
    })

    expect(settingsResponse.status).toBe(200)

    const draftResponse = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sourceText: '明天下午三点和张总在国贸喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const draftPayload = (await draftResponse.json()) as {
      data: { draft: { draftId: string } }
    }

    const createResponse = await app.request('/api/v1/events', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        draftId: draftPayload.data.draft.draftId,
      }),
    })
    const createPayload = (await createResponse.json()) as EventPayload

    expect(createResponse.status).toBe(200)
    expect(createPayload.data.event.reminders).toHaveLength(1)
    expect(createPayload.data.event.reminders[0]).toEqual(
      expect.objectContaining({
        minutesBefore: 30,
      }),
    )

    await runtime.dispose()
  })

  test('filters event lists by date range, keyword, source, and priority', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const auth = await registerAndGetAccessToken(app, 'events-filter@example.com')

    const firstEventId = await createEvent(app, auth.accessToken, {
      title: '客户会议',
      startTime: '2026-06-01T08:00:00.000Z',
      endTime: '2026-06-01T09:00:00.000Z',
      source: 'manual',
      priority: 'high',
      tags: ['客户'],
    })
    const secondEventId = await createEvent(app, auth.accessToken, {
      title: '健身提醒',
      startTime: '2026-06-03T12:00:00.000Z',
      endTime: '2026-06-03T13:00:00.000Z',
      source: 'voice',
      priority: 'normal',
      tags: ['健康'],
    })
    const thirdEventId = await createEvent(app, auth.accessToken, {
      title: '项目复盘',
      startTime: '2026-06-05T10:00:00.000Z',
      endTime: '2026-06-05T11:00:00.000Z',
      source: 'manual',
      priority: 'low',
      tags: ['项目'],
    })

    const dateFilteredResponse = await app.request(
      '/api/v1/events?limit=10&startDate=2026-06-02T00:00:00.000Z&endDate=2026-06-04T00:00:00.000Z',
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const dateFilteredPayload = (await dateFilteredResponse.json()) as EventListPayload

    expect(dateFilteredResponse.status).toBe(200)
    expect(dateFilteredPayload.data.items.map((item) => item.id)).toEqual([secondEventId])

    const keywordFilteredResponse = await app.request('/api/v1/events?limit=10&keyword=客户', {
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
      },
    })
    const keywordFilteredPayload = (await keywordFilteredResponse.json()) as EventListPayload

    expect(keywordFilteredResponse.status).toBe(200)
    expect(keywordFilteredPayload.data.items.map((item) => item.id)).toEqual([firstEventId])

    const sourcePriorityResponse = await app.request(
      '/api/v1/events?limit=10&source=manual&priority=low',
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const sourcePriorityPayload = (await sourcePriorityResponse.json()) as EventListPayload

    expect(sourcePriorityResponse.status).toBe(200)
    expect(sourcePriorityPayload.data.items.map((item) => item.id)).toEqual([thirdEventId])

    await runtime.dispose()
  })

  test('supports recurrence scope updates and deletes for recurring events', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const auth = await registerAndGetAccessToken(app, 'events-recurring@example.com')
    const recurringEventId = await createEvent(app, auth.accessToken)

    const recurringSeedResponse = await app.request(`/api/v1/events/${recurringEventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '每周客户会议',
        description: null,
        startTime: '2026-06-01T08:00:00.000Z',
        endTime: '2026-06-01T09:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '线上会议',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          byWeekDay: [1, 3, 5],
          byMonthDay: [],
          until: null,
          count: 6,
        },
        reminders: [],
        attendees: [],
        priority: 'normal',
        tags: [],
        source: 'manual',
        recurrenceScope: 'all',
      }),
    })
    const recurringSeedPayload = (await recurringSeedResponse.json()) as EventPayload

    expect(recurringSeedResponse.status).toBe(200)
    expect(recurringSeedPayload.data.event.recurrence?.frequency).toBe('weekly')
    expect(recurringSeedPayload.data.event.recurrence?.count).toBe(6)

    const singleUpdateResponse = await app.request(`/api/v1/events/${recurringEventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '单次改期客户会议',
        description: null,
        startTime: '2026-06-03T10:00:00.000Z',
        endTime: '2026-06-03T11:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '2 号会议室',
        recurrence: recurringSeedPayload.data.event.recurrence,
        reminders: [],
        attendees: [],
        priority: 'high',
        tags: ['客户'],
        source: 'manual',
        recurrenceScope: 'single',
        occurrenceStartTime: '2026-06-03T08:00:00.000Z',
      }),
    })
    const singleUpdatePayload = (await singleUpdateResponse.json()) as EventPayload

    expect(singleUpdateResponse.status).toBe(200)
    expect(singleUpdatePayload.data.event.title).toBe('单次改期客户会议')
    expect(singleUpdatePayload.data.event.startTime).toBe('2026-06-03T10:00:00.000Z')
    expect(singleUpdatePayload.data.event.recurrence).toBeNull()

    const recurringDetailAfterSingleResponse = await app.request(
      `/api/v1/events/${recurringEventId}`,
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const recurringDetailAfterSinglePayload =
      (await recurringDetailAfterSingleResponse.json()) as EventPayload

    expect(recurringDetailAfterSingleResponse.status).toBe(200)
    expect(recurringDetailAfterSinglePayload.data.event.recurrence?.exclusions).toContain(
      '2026-06-03T08:00:00.000Z',
    )

    const followingUpdateResponse = await app.request(`/api/v1/events/${recurringEventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '后续项目例会',
        description: null,
        startTime: '2026-06-05T09:30:00.000Z',
        endTime: '2026-06-05T10:30:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '项目会议室',
        recurrence: recurringSeedPayload.data.event.recurrence,
        reminders: [],
        attendees: [],
        priority: 'normal',
        tags: ['项目'],
        source: 'manual',
        recurrenceScope: 'following',
        occurrenceStartTime: '2026-06-05T08:00:00.000Z',
      }),
    })
    const followingUpdatePayload = (await followingUpdateResponse.json()) as EventPayload

    expect(followingUpdateResponse.status).toBe(200)
    expect(followingUpdatePayload.data.event.title).toBe('后续项目例会')
    expect(followingUpdatePayload.data.event.id).not.toBe(recurringEventId)
    expect(followingUpdatePayload.data.event.recurrence?.count).toBe(4)

    const recurringDetailAfterFollowingResponse = await app.request(
      `/api/v1/events/${recurringEventId}`,
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const recurringDetailAfterFollowingPayload =
      (await recurringDetailAfterFollowingResponse.json()) as EventPayload

    expect(recurringDetailAfterFollowingResponse.status).toBe(200)
    expect(recurringDetailAfterFollowingPayload.data.event.recurrence?.count).toBe(2)
    expect(recurringDetailAfterFollowingPayload.data.event.recurrence?.exclusions).toContain(
      '2026-06-03T08:00:00.000Z',
    )

    const singleDeleteResponse = await app.request(
      `/api/v1/events/${followingUpdatePayload.data.event.id}?recurrenceScope=single&occurrenceStartTime=2026-06-08T09:30:00.000Z`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )

    expect(singleDeleteResponse.status).toBe(200)

    const followingSeriesAfterSingleDeleteResponse = await app.request(
      `/api/v1/events/${followingUpdatePayload.data.event.id}`,
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const followingSeriesAfterSingleDeletePayload =
      (await followingSeriesAfterSingleDeleteResponse.json()) as EventPayload

    expect(followingSeriesAfterSingleDeleteResponse.status).toBe(200)
    expect(followingSeriesAfterSingleDeletePayload.data.event.recurrence?.exclusions).toContain(
      '2026-06-08T09:30:00.000Z',
    )

    const followingDeleteResponse = await app.request(
      `/api/v1/events/${followingUpdatePayload.data.event.id}?recurrenceScope=following&occurrenceStartTime=2026-06-10T09:30:00.000Z`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )

    expect(followingDeleteResponse.status).toBe(200)

    const followingSeriesAfterDeleteResponse = await app.request(
      `/api/v1/events/${followingUpdatePayload.data.event.id}`,
      {
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const followingSeriesAfterDeletePayload =
      (await followingSeriesAfterDeleteResponse.json()) as EventPayload

    expect(followingSeriesAfterDeleteResponse.status).toBe(200)
    expect(followingSeriesAfterDeletePayload.data.event.recurrence?.count).toBe(2)
    expect(followingSeriesAfterDeletePayload.data.event.recurrence?.exclusions).toContain(
      '2026-06-08T09:30:00.000Z',
    )

    await runtime.dispose()
  })

  test('validates recurrence occurrence anchor for scoped recurring updates and deletes', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const auth = await registerAndGetAccessToken(app, 'events-recurring-validation@example.com')
    const recurringEventId = await createEvent(app, auth.accessToken)

    await app.request(`/api/v1/events/${recurringEventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '每周客户会议',
        description: null,
        startTime: '2026-06-01T08:00:00.000Z',
        endTime: '2026-06-01T09:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '线上会议',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          byWeekDay: [1, 3, 5],
          byMonthDay: [],
          until: null,
          count: 6,
        },
        reminders: [],
        attendees: [],
        priority: 'normal',
        tags: [],
        source: 'manual',
        recurrenceScope: 'all',
      }),
    })

    const updateResponse = await app.request(`/api/v1/events/${recurringEventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${auth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '缺失锚点的单次修改',
        description: null,
        startTime: '2026-06-03T10:00:00.000Z',
        endTime: '2026-06-03T11:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '线上会议',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          byWeekDay: [1, 3, 5],
          byMonthDay: [],
          until: null,
          count: 6,
        },
        reminders: [],
        attendees: [],
        priority: 'normal',
        tags: [],
        source: 'manual',
        recurrenceScope: 'single',
      }),
    })
    const updatePayload = (await updateResponse.json()) as ErrorPayload

    expect(updateResponse.status).toBe(400)
    expect(updatePayload.error.code).toBe('VALIDATION_ERROR')

    const deleteResponse = await app.request(
      `/api/v1/events/${recurringEventId}?recurrenceScope=following`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${auth.accessToken}`,
        },
      },
    )
    const deletePayload = (await deleteResponse.json()) as ErrorPayload

    expect(deleteResponse.status).toBe(400)
    expect(deletePayload.error.code).toBe('VALIDATION_ERROR')

    await runtime.dispose()
  })
})

async function registerAndGetAccessToken(app: ReturnType<typeof createApp>, email: string) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'strong-pass-123',
      name: 'Event User',
    }),
  })
  const payload = (await response.json()) as AuthPayload

  return {
    accessToken: payload.data.accessToken,
    userId: payload.data.user.id,
  }
}

async function createEvent(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  overrides?: {
    title?: string
    startTime?: string
    endTime?: string | null
    source?: 'voice' | 'manual'
    priority?: 'low' | 'normal' | 'high'
    tags?: string[]
  },
) {
  const draftResponse = await app.request('/api/v1/drafts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sourceText: '明天下午三点喝咖啡',
      timezone: 'Asia/Shanghai',
      referenceAt: '2026-05-29T02:00:00Z',
      source: 'text',
    }),
  })
  const draftPayload = (await draftResponse.json()) as {
    data: { draft: { draftId: string } }
  }

  const updateDraftResponse = await app.request(
    `/api/v1/drafts/${draftPayload.data.draft.draftId}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userInput: '客户会议 下午三点开始',
        referenceAt: '2026-05-29T02:05:00Z',
      }),
    },
  )

  expect(updateDraftResponse.status).toBe(200)

  const eventResponse = await app.request('/api/v1/events', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      draftId: draftPayload.data.draft.draftId,
    }),
  })
  const eventPayload = (await eventResponse.json()) as EventPayload

  if (!overrides) {
    return eventPayload.data.event.id
  }

  const updateResponse = await app.request(`/api/v1/events/${eventPayload.data.event.id}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title: overrides.title ?? '客户会议',
      description: null,
      startTime: overrides.startTime ?? eventPayload.data.event.startTime,
      endTime: overrides.endTime === undefined ? '2026-06-01T09:00:00.000Z' : overrides.endTime,
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: null,
      recurrence: null,
      reminders: [],
      attendees: [],
      priority: overrides.priority ?? 'normal',
      tags: overrides.tags ?? [],
      source: overrides.source ?? 'manual',
    }),
  })

  expect(updateResponse.status).toBe(200)

  return eventPayload.data.event.id
}

const testEnv = {
  PORT: '8061',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
  JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ALIYUN_ACCESS_KEY_ID: 'akid',
  ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
  ALIYUN_NLS_APP_KEY: 'appkey',
} as const
