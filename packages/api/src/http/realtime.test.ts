import { describe, expect, test } from 'vitest'
import { WebSocket } from 'ws'

import { createRuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { notificationMemoryRepository } from '../repositories/notifications.memory.js'
import { realtimeMemoryRepository } from '../repositories/realtime.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'
import { startTestServer } from './test-server.js'

describe('realtime route', () => {
  test('does not push notification.new immediately after reminder replacement', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    const eventId = await createEvent(app, accessToken)

    await app.request(`/api/v1/events/${eventId}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '客户会议',
        description: null,
        startTime: '2026-05-30T08:00:00.000Z',
        endTime: '2026-05-30T09:00:00.000Z',
        allDay: false,
        timezone: 'Asia/Shanghai',
        location: '线上会议',
        recurrence: null,
        reminders: [],
        attendees: [],
        priority: 'high',
        tags: [],
        source: 'manual',
      }),
    })

    const server = await startTestServer(runtime)

    try {
      const { ws, readJsonMessage } = await openWebSocket(
        `${server.baseUrl.replace('http', 'ws')}/api/v1/realtime/ws?accessToken=${accessToken}`,
      )
      const bufferedMessage = await readJsonMessage()

      expect(bufferedMessage).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      await drainJsonMessages(readJsonMessage)

      await app.request(`/api/v1/events/${eventId}/reminders`, {
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

      const immediateMessage = await readJsonMessage()

      expect(immediateMessage).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      const noImmediateNotification = await Promise.race([
        readJsonMessage().then((message) => message.type !== 'notification.new'),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 150)),
      ])

      expect(noImmediateNotification).toBe(true)

      await closeWebSocket(ws)
      await runtime.dispose()
    } finally {
      await server.close()
    }
  })

  test('only replays realtime events for the authenticated user', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const firstAccessToken = await registerAndGetAccessToken(app, 'realtime-1@example.com')
    const secondAccessToken = await registerAndGetAccessToken(app, 'realtime-2@example.com')

    await createEvent(app, firstAccessToken)
    const server = await startTestServer(runtime)

    try {
      const { ws, readJsonMessage } = await openWebSocket(
        `${server.baseUrl.replace('http', 'ws')}/api/v1/realtime/ws?accessToken=${secondAccessToken}`,
      )

      ws.send('ping')

      const noMessage = await Promise.race([
        readJsonMessage().then(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 150)),
      ])

      expect(noMessage).toBe(true)

      await closeWebSocket(ws)
      await runtime.dispose()
    } finally {
      await server.close()
    }
  })

  test('streams draft clarification events for the owning user', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app, 'realtime-draft@example.com')
    const server = await startTestServer(runtime)

    try {
      const { ws, readJsonMessage } = await openWebSocket(
        `${server.baseUrl.replace('http', 'ws')}/api/v1/realtime/ws?accessToken=${accessToken}`,
      )

      const draftResponse = await app.request('/api/v1/drafts', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sourceText: '明天和张总喝咖啡',
          timezone: 'Asia/Shanghai',
          referenceAt: '2026-05-29T02:00:00Z',
          source: 'text',
        }),
      })

      expect(draftResponse.status).toBe(200)

      const clarificationMessage = await readJsonMessage()

      expect(clarificationMessage).toEqual(
        expect.objectContaining({
          type: 'draft.clarification',
          payload: expect.objectContaining({
            draftId: expect.any(String),
            clarificationPrompt: '请补充开始时间。',
          }),
        }),
      )

      await closeWebSocket(ws)
      await runtime.dispose()
    } finally {
      await server.close()
    }
  })

  test('pushes event.updated after attendee and reminder mutations', async () => {
    eventMemoryRepository.reset()
    notificationMemoryRepository.reset()
    realtimeMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app, 'realtime-event-updates@example.com')
    const eventId = await createEvent(app, accessToken)
    const server = await startTestServer(runtime)

    try {
      const { ws, readJsonMessage } = await openWebSocket(
        `${server.baseUrl.replace('http', 'ws')}/api/v1/realtime/ws?accessToken=${accessToken}`,
      )

      await drainJsonMessages(readJsonMessage)

      const attendeeResponse = await app.request(`/api/v1/events/${eventId}/attendees`, {
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
      const attendeePayload = (await attendeeResponse.json()) as {
        data: {
          attendee: {
            id: string
          }
        }
      }

      expect(attendeeResponse.status).toBe(200)

      const addAttendeeUpdate = await readJsonMessage()

      expect(addAttendeeUpdate).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      await app.request(`/api/v1/events/${eventId}/attendees/${attendeePayload.data.attendee.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'accepted',
        }),
      })

      const patchAttendeeUpdate = await readJsonMessage()

      expect(patchAttendeeUpdate).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      await app.request(`/api/v1/events/${eventId}/reminders`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reminders: [
            {
              id: 'rem_event_update',
              eventId,
              minutesBefore: 15,
              method: 'push',
              sentAt: null,
            },
          ],
        }),
      })

      const reminderUpdate = await readJsonMessage()

      expect(reminderUpdate).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      await app.request(`/api/v1/events/${eventId}/attendees/${attendeePayload.data.attendee.id}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })

      const deleteAttendeeUpdate = await readJsonMessage()

      expect(deleteAttendeeUpdate).toEqual(
        expect.objectContaining({
          type: 'event.updated',
          payload: expect.objectContaining({
            eventId,
          }),
        }),
      )

      await closeWebSocket(ws)
      await runtime.dispose()
    } finally {
      await server.close()
    }
  })
})

async function registerAndGetAccessToken(
  app: ReturnType<typeof createApp>,
  email = 'realtime@example.com',
) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'strong-pass-123',
      name: 'Realtime User',
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

async function openWebSocket(url: string) {
  const ws = new WebSocket(url)
  const readJsonMessage = createJsonMessageReader(ws)

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      ws.off('open', onOpen)
      ws.off('error', onError)
    }

    ws.on('open', onOpen)
    ws.on('error', onError)
  })

  return { ws, readJsonMessage }
}

function createJsonMessageReader(ws: WebSocket) {
  const queue: string[] = []
  let resolvePending: ((value: string) => void) | null = null

  ws.on('message', (message, isBinary) => {
    const next = rawDataToString(message, isBinary)
    if (resolvePending) {
      const resolve = resolvePending

      resolvePending = null
      resolve(next)
      return
    }

    queue.push(next)
  })

  return async () => {
    const data =
      queue.shift() ??
      (await new Promise<string>((resolve, reject) => {
        const onError = (error: Error) => {
          ws.off('error', onError)
          reject(error)
        }

        resolvePending = (value) => {
          ws.off('error', onError)
          resolve(value)
        }
        ws.on('error', onError)
      }))

    return JSON.parse(data) as Record<string, unknown>
  }
}

function rawDataToString(message: string | Buffer | ArrayBuffer | Buffer[], isBinary: boolean) {
  if (!isBinary) {
    if (typeof message === 'string') {
      return message
    }

    if (message instanceof ArrayBuffer) {
      return Buffer.from(message).toString()
    }

    if (Array.isArray(message)) {
      return Buffer.concat(message).toString()
    }

    return message.toString()
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString()
  }

  if (Array.isArray(message)) {
    return Buffer.concat(message).toString()
  }

  return Buffer.from(message).toString()
}

async function closeWebSocket(ws: WebSocket) {
  await new Promise<void>((resolve) => {
    ws.once('close', () => resolve())
    ws.close()
  })
}

async function drainJsonMessages(readJsonMessage: () => Promise<Record<string, unknown>>) {
  while (true) {
    const empty = await Promise.race([
      readJsonMessage().then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50)),
    ])

    if (empty) {
      return
    }
  }
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
