import { describe, expect, test } from 'vitest'

import { createRuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'

type AuthPayload = {
  data: {
    accessToken: string
  }
}

type EventPayload = {
  data: {
    event: {
      id: string
    }
  }
}

type NotificationListPayload = {
  data: {
    items: Array<{
      id: string
      title: string
      message: string
      read: boolean
      time: string
    }>
  }
}

describe('notifications and reminders routes', () => {
  test('only exposes notifications to the owning user', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const firstAccessToken = await registerAndGetAccessToken(app)
    const secondAccessToken = await registerAndGetAccessToken(app, 'notifications-2@example.com')
    const eventId = await createEvent(app, firstAccessToken)
    const notificationId = await createReminderNotification(app, firstAccessToken, eventId)

    const secondListResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${secondAccessToken}`,
      },
    })
    const secondListPayload = (await secondListResponse.json()) as NotificationListPayload

    expect(secondListResponse.status).toBe(200)
    expect(secondListPayload.data.items).toHaveLength(0)

    for (const [method, path] of [
      ['PATCH', `/api/v1/notifications/${notificationId}`],
      ['POST', `/api/v1/notifications/${notificationId}/snooze`],
      ['DELETE', `/api/v1/notifications/${notificationId}`],
    ] as const) {
      const response = await app.request(path, {
        method,
        headers: {
          authorization: `Bearer ${secondAccessToken}`,
          'content-type': 'application/json',
        },
        body:
          method === 'PATCH'
            ? JSON.stringify({ read: true })
            : method === 'POST'
              ? JSON.stringify({ minutes: 10 })
              : undefined,
      })

      expect(response.status).toBe(404)
    }

    await runtime.dispose()
  })

  test('updates event reminders without immediately creating notifications', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    const eventId = await createEvent(app, accessToken)

    const remindersResponse = await createReminderRequest(app, accessToken, eventId)

    expect(remindersResponse.status).toBe(200)

    const listResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const listPayload = (await listResponse.json()) as NotificationListPayload

    expect(listResponse.status).toBe(200)
    expect(listPayload.data.items).toHaveLength(0)

    await runtime.dispose()
  })

  test('lists due notifications after reminder processing, and supports read toggling, delete, and snooze', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    const eventId = await createEvent(app, accessToken)

    const remindersResponse = await createReminderRequest(app, accessToken, eventId)

    expect(remindersResponse.status).toBe(200)

    await processReminderQueue(runtime, '2026-05-30T06:50:00.000Z')

    const listResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const listPayload = (await listResponse.json()) as NotificationListPayload

    expect(listResponse.status).toBe(200)
    expect(listPayload.data.items).toHaveLength(1)
    expect(listPayload.data.items[0]?.read).toBe(false)

    const notificationId = listPayload.data.items[0]?.id as string

    const markReadResponse = await app.request(`/api/v1/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        read: true,
      }),
    })

    expect(markReadResponse.status).toBe(200)

    const snoozeResponse = await app.request(`/api/v1/notifications/${notificationId}/snooze`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        minutes: 10,
      }),
    })

    expect(snoozeResponse.status).toBe(200)

    const deleteResponse = await app.request(`/api/v1/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(deleteResponse.status).toBe(200)

    const emptyListResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const emptyListPayload = (await emptyListResponse.json()) as NotificationListPayload

    expect(emptyListResponse.status).toBe(200)
    expect(emptyListPayload.data.items).toHaveLength(0)

    await runtime.dispose()
  })

  test('creates notifications for newly created events using the user default reminder setting', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(
      app,
      'notifications-default-reminder@example.com',
    )

    const settingsResponse = await app.request('/api/v1/me/settings', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        defaultReminderMinutes: 30,
      }),
    })

    expect(settingsResponse.status).toBe(200)

    const eventId = await createEvent(app, accessToken)

    await processReminderQueue(runtime, '2026-05-30T06:30:00.000Z')

    const listResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const listPayload = (await listResponse.json()) as NotificationListPayload

    expect(listResponse.status).toBe(200)
    expect(listPayload.data.items).toHaveLength(1)
    expect(listPayload.data.items[0]).toEqual(
      expect.objectContaining({
        read: false,
      }),
    )
    expect(listPayload.data.items[0]?.title).toContain('提醒')
    expect(listPayload.data.items[0]?.message).toContain('30 分钟后开始')

    const deleteResponse = await app.request(`/api/v1/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(deleteResponse.status).toBe(200)

    await runtime.dispose()
  })
})

async function registerAndGetAccessToken(
  app: ReturnType<typeof createApp>,
  email = 'notifications@example.com',
) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'strong-pass-123',
      name: 'Notification User',
    }),
  })
  const payload = (await response.json()) as AuthPayload

  return payload.data.accessToken
}

async function createReminderNotification(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  eventId: string,
) {
  await createReminderRequest(app, accessToken, eventId)

  const listResponse = await app.request('/api/v1/notifications', {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })
  const listPayload = (await listResponse.json()) as NotificationListPayload

  return listPayload.data.items[0]?.id as string
}

async function createReminderRequest(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  eventId: string,
) {
  return await app.request(`/api/v1/events/${eventId}/reminders`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      reminders: [
        {
          id: 'rem_1',
          eventId,
          minutesBefore: 15,
          method: 'push',
          sentAt: null,
        },
      ],
    }),
  })
}

async function processReminderQueue(
  runtime: Awaited<ReturnType<typeof createRuntimeDependencies>>,
  now: string,
) {
  const processFn = (
    runtime as {
      reminders?: {
        processDue: (input: { now: string }) => Promise<{ processedCount: number }>
      }
    }
  ).reminders?.processDue

  if (!processFn) {
    throw new Error('runtime.reminders.processDue is not available')
  }

  return await processFn({ now })
}

async function createEvent(app: ReturnType<typeof createApp>, accessToken: string) {
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
