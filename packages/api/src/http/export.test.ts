import { describe, expect, test } from 'vitest'

import { createRuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { createApp } from './app.js'

describe('export routes', () => {
  test('exports current user profile and events in csv and ics formats', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    await createEvent(app, accessToken)

    const csvResponse = await app.request('/api/v1/me/export?format=csv', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const csvText = await csvResponse.text()

    expect(csvResponse.status).toBe(200)
    expect(csvResponse.headers.get('content-type')).toContain('text/csv')
    expect(csvResponse.headers.get('content-disposition')).toBe(
      'attachment; filename="vocalendar-export.csv"',
    )
    expect(csvText).toContain('email,name')
    expect(csvText).toContain('export@example.com,Export User')
    expect(csvText).toContain(
      'eventId,title,description,startTime,endTime,timezone,location,source,priority,allDay,tags,recurrence,reminders,attendees',
    )
    expect(csvText).toContain('客户会议')
    expect(csvText).toContain('和客户确认方案')
    expect(csvText).toContain('"[""客户"",""售前""]"')
    expect(csvText).toContain('"[{""id"":""rem_export""')
    expect(csvText).toContain('"[{""id"":""att_export""')

    const icsResponse = await app.request('/api/v1/me/export?format=ics', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const icsText = await icsResponse.text()

    expect(icsResponse.status).toBe(200)
    expect(icsResponse.headers.get('content-type')).toContain('text/calendar')
    expect(icsResponse.headers.get('content-disposition')).toBe(
      'attachment; filename="vocalendar-export.ics"',
    )
    expect(icsText).toContain('BEGIN:VCALENDAR')
    expect(icsText).toContain('PRODID:-//Vocalendar//EN')
    expect(icsText).toContain('BEGIN:VEVENT')
    expect(icsText).toContain('SUMMARY:客户会议')
    expect(icsText).toContain('DESCRIPTION:和客户确认方案')
    expect(icsText).toContain('LOCATION:国贸三期')
    expect(icsText).toContain('RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO,WE')
    expect(icsText).toContain('ATTENDEE;CN=张总:mailto:zhang@example.com')
    expect(icsText).toContain('BEGIN:VALARM')
    expect(icsText).toContain('TRIGGER:-PT15M')

    await runtime.dispose()
  })

  test('returns a unified unauthorized error when export is requested without auth', async () => {
    eventMemoryRepository.reset()
    userMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })

    const response = await app.request('/api/v1/me/export?format=csv')
    const payload = (await response.json()) as {
      error: {
        code: string
      }
    }

    expect(response.status).toBe(401)
    expect(payload.error.code).toBe('UNAUTHORIZED')

    await runtime.dispose()
  })
})

async function registerAndGetAccessToken(app: ReturnType<typeof createApp>) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'export@example.com',
      password: 'strong-pass-123',
      name: 'Export User',
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
      sourceText: '明天下午三点客户会议',
      timezone: 'Asia/Shanghai',
      referenceAt: '2026-05-29T02:00:00Z',
      source: 'text',
    }),
  })
  const draftPayload = (await draftResponse.json()) as {
    data: { draft: { draftId: string } }
  }

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

  expect(eventResponse.status).toBe(200)

  const eventPayload = (await eventResponse.json()) as {
    data: {
      event: {
        id: string
      }
    }
  }

  const updateResponse = await app.request(`/api/v1/events/${eventPayload.data.event.id}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      title: '客户会议',
      description: '和客户确认方案',
      startTime: '2026-05-30T08:00:00.000Z',
      endTime: '2026-05-30T09:00:00.000Z',
      allDay: false,
      timezone: 'Asia/Shanghai',
      location: '国贸三期',
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        byWeekDay: [1, 3],
        byMonthDay: [],
        until: null,
        count: 4,
        exclusions: [],
      },
      reminders: [
        {
          id: 'rem_export',
          eventId: eventPayload.data.event.id,
          minutesBefore: 15,
          method: 'push',
          sentAt: null,
        },
      ],
      attendees: [
        {
          id: 'att_export',
          name: '张总',
          email: 'zhang@example.com',
          status: 'pending',
        },
      ],
      priority: 'high',
      tags: ['客户', '售前'],
      source: 'manual',
    }),
  })

  expect(updateResponse.status).toBe(200)
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
