import { describe, expect, test } from 'vitest'

import { createRuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { notificationMemoryRepository } from '../repositories/notifications.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'

describe('attendee routes', () => {
  test('adds, updates, and removes attendees on an event', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    const eventId = await createEvent(app, accessToken)

    const addResponse = await app.request(`/api/v1/events/${eventId}/attendees`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: '张总',
        email: 'zhang@example.com',
      }),
    })
    const addPayload = (await addResponse.json()) as {
      data: {
        attendee: {
          id: string
          status: string
        }
      }
    }

    expect(addResponse.status).toBe(200)
    expect(addPayload.data.attendee.status).toBe('pending')

    const attendeeId = addPayload.data.attendee.id

    const patchResponse = await app.request(`/api/v1/events/${eventId}/attendees/${attendeeId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'accepted',
      }),
    })
    const patchPayload = (await patchResponse.json()) as {
      data: {
        attendee: {
          status: string
        }
      }
    }

    expect(patchResponse.status).toBe(200)
    expect(patchPayload.data.attendee.status).toBe('accepted')

    const deleteResponse = await app.request(`/api/v1/events/${eventId}/attendees/${attendeeId}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(deleteResponse.status).toBe(200)

    await runtime.dispose()
  })

  test('sends internal invitations to attendees who already have Vocalendar accounts', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const ownerAccessToken = await registerAndGetAccessToken(app, 'owner@example.com', 'Owner User')
    const attendeeAccessToken = await registerAndGetAccessToken(app, 'zhang@example.com', '张总')
    const eventId = await createEvent(app, ownerAccessToken)

    await app.request(`/api/v1/events/${eventId}/attendees`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: '张总',
        email: 'zhang@example.com',
      }),
    })

    const inviteResponse = await app.request(`/api/v1/events/${eventId}/attendees/invitations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerAccessToken}`,
      },
    })
    const invitePayload = (await inviteResponse.json()) as {
      data: {
        sentCount: number
        skippedCount: number
      }
    }

    expect(inviteResponse.status).toBe(200)
    expect(invitePayload.data.sentCount).toBe(1)
    expect(invitePayload.data.skippedCount).toBe(0)

    const notificationsResponse = await app.request('/api/v1/notifications', {
      headers: {
        authorization: `Bearer ${attendeeAccessToken}`,
      },
    })
    const notificationsPayload = (await notificationsResponse.json()) as {
      data: {
        items: Array<{
          title: string
          message: string
        }>
      }
    }

    expect(notificationsResponse.status).toBe(200)
    expect(notificationsPayload.data.items).toHaveLength(1)
    expect(notificationsPayload.data.items[0]?.title).toContain('邀请')
    expect(notificationsPayload.data.items[0]?.message).toContain('客户会议')

    await runtime.dispose()
  })
})

async function registerAndGetAccessToken(
  app: ReturnType<typeof createApp>,
  email = 'attendees@example.com',
  name = 'Attendee User',
) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'strong-pass-123',
      name,
    }),
  })
  const payload = (await response.json()) as {
    data: {
      accessToken: string
    }
  }

  return payload.data.accessToken
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
  const eventPayload = (await eventResponse.json()) as {
    data: { event: { id: string } }
  }

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
