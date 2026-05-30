import { describe, expect, test } from 'vitest'

import { eventMemoryRepository } from '../repositories/events.memory.js'
import { createApp } from './app.js'

const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

type DraftResponsePayload = {
  data: {
    draft: {
      draftId: string
      sourceText: string
      source: string
      referenceAt: string
      normalizedText?: string
      parsed: {
        title: string | null
        startAt: string | null
        endAt: string | null
        timezone: string
        location: string | null
        participants: string[]
      }
      missingFields: string[]
      warnings: string[]
      canSave: boolean
      clarificationPrompt: string | null
    }
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

type EventListResponsePayload = {
  data: {
    items: Array<{
      id: string
      title: string
      startAt: string
      location: string | null
    }>
    total: number
  }
}

type EventResponsePayload = {
  data: {
    event: {
      id: string
      title: string
      startAt: string
      endAt: string | null
      timezone: string
      location: string | null
      participants: string[]
      source: string
      status: string
      createdAt: string
      updatedAt: string
    }
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

type ErrorResponsePayload = {
  error: {
    code: string
    message: string
    details: unknown
  }
  meta: {
    requestId: string
    timestamp: string
  }
}

describe('v0.1 API contract', () => {
  test('creates a savable draft for explicit date time and entities', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天下午三点和张总在国贸喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as DraftResponsePayload

    expect(response.status).toBe(200)
    expect(payload.meta.requestId).toBe('dev-request')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
    expect(payload.data.draft.draftId).toEqual(expect.any(String))
    expect(payload.data.draft.sourceText).toBe('明天下午三点和张总在国贸喝咖啡')
    expect(payload.data.draft.source).toBe('text')
    expect(payload.data.draft.referenceAt).toBe('2026-05-29T02:00:00Z')
    if ('normalizedText' in payload.data.draft) {
      expect(payload.data.draft.normalizedText).toEqual(expect.any(String))
    }
    expect(payload.data.draft.parsed.title).toBe('喝咖啡')
    expect(payload.data.draft.parsed.startAt).toBe('2026-05-30T07:00:00.000Z')
    expect(payload.data.draft.parsed.endAt).toBeNull()
    expect(payload.data.draft.parsed.timezone).toBe('Asia/Shanghai')
    expect(payload.data.draft.parsed.location).toBe('国贸')
    expect(payload.data.draft.parsed.participants).toEqual(['张总'])
    expect(payload.data.draft.missingFields).toEqual([])
    expect(payload.data.draft.warnings).toEqual([])
    expect(payload.data.draft.canSave).toBe(true)
    expect(payload.data.draft.clarificationPrompt).toBeNull()
  })

  test('keeps a date-only draft unsavable instead of guessing startAt', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天和张总喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as DraftResponsePayload

    expect(response.status).toBe(200)
    expect(payload.meta.requestId).toBe('dev-request')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
    expect(payload.data.draft.draftId).toEqual(expect.any(String))
    expect(payload.data.draft.sourceText).toBe('明天和张总喝咖啡')
    expect(payload.data.draft.source).toBe('text')
    expect(payload.data.draft.referenceAt).toBe('2026-05-29T02:00:00Z')
    if ('normalizedText' in payload.data.draft) {
      expect(payload.data.draft.normalizedText).toEqual(expect.any(String))
    }
    expect(payload.data.draft.parsed.title).toBe('喝咖啡')
    expect(payload.data.draft.parsed.startAt).toBeNull()
    expect(payload.data.draft.parsed.endAt).toBeNull()
    expect(payload.data.draft.parsed.timezone).toBe('Asia/Shanghai')
    expect(payload.data.draft.missingFields).toEqual(['startAt'])
    expect(payload.data.draft.canSave).toBe(false)
    expect(payload.data.draft.clarificationPrompt).toBe('请补充开始时间。')
  })

  test('rejects draft creation when sourceText is empty', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.message).toBe('Request payload is invalid.')
    expect(payload.error.details).toEqual(
      expect.objectContaining({
        fieldErrors: expect.objectContaining({
          sourceText: expect.anything(),
        }),
      }),
    )
    expect(payload.meta.requestId).toBe('dev-request')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
  })

  test('rejects draft creation when timezone is invalid', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天下午三点喝咖啡',
        timezone: 'Invalid/Timezone',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
    expect(payload.error.details).toEqual(
      expect.objectContaining({
        fieldErrors: expect.objectContaining({
          timezone: expect.anything(),
        }),
      }),
    )
    expect(payload.meta.requestId).toBe('dev-request')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
  })

  test('returns draft parse failed when no event signal can be extracted', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '啊啊啊',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(422)
    expect(payload.error.code).toBe('DRAFT_PARSE_FAILED')
    expect(payload.error.message).toBe('Source text cannot be parsed into a valid draft.')
    expect(payload.error.details).toEqual({ sourceText: '啊啊啊' })
    expect(payload.meta.requestId).toBe('dev-request')
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
  })

  test('updates a draft, creates an event, and returns it in the recent list', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const draftResponse = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天和张总喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const draftPayload = (await draftResponse.json()) as DraftResponsePayload

    const updateResponse = await app.request(`/api/v1/drafts/${draftPayload.data.draft.draftId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userInput: '下午三点开始',
        referenceAt: '2026-05-29T02:05:00Z',
        fields: {
          location: '国贸',
        },
      }),
    })
    const updatePayload = (await updateResponse.json()) as DraftResponsePayload

    expect(updateResponse.status).toBe(200)
    expect(updatePayload.data.draft.parsed.title).toBe('喝咖啡')
    expect(updatePayload.data.draft.parsed.startAt).toBe('2026-05-30T07:00:00.000Z')
    expect(updatePayload.data.draft.parsed.location).toBe('国贸')
    expect(updatePayload.data.draft.parsed.participants).toEqual(['张总'])
    expect(updatePayload.data.draft.missingFields).toEqual([])
    expect(updatePayload.data.draft.canSave).toBe(true)
    expect(updatePayload.data.draft.clarificationPrompt).toBeNull()

    const eventResponse = await app.request('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draftId: draftPayload.data.draft.draftId,
      }),
    })
    const eventPayload = (await eventResponse.json()) as EventResponsePayload

    expect(eventResponse.status).toBe(200)
    expect(eventPayload.data.event.id).toEqual(expect.any(String))
    expect(eventPayload.data.event.title).toBe('喝咖啡')
    expect(eventPayload.data.event.startAt).toBe('2026-05-30T07:00:00.000Z')
    expect(eventPayload.data.event.location).toBe('国贸')
    expect(eventPayload.data.event.status).toBe('confirmed')
    expect(eventPayload.meta.timestamp).toMatch(isoTimestampPattern)

    const recentResponse = await app.request('/api/v1/events?mode=recent&limit=5')
    const recentPayload = (await recentResponse.json()) as EventListResponsePayload

    expect(recentResponse.status).toBe(200)
    expect(recentPayload.data.total).toBe(1)
    expect(recentPayload.data.items).toHaveLength(1)
    expect(recentPayload.data.items[0]).toEqual(
      expect.objectContaining({
        id: eventPayload.data.event.id,
        title: '喝咖啡',
        startAt: '2026-05-30T07:00:00.000Z',
        location: '国贸',
      }),
    )
  })

  test('supports recent list pagination with limit and offset', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    for (const [index, title] of ['事件一', '事件二', '事件三'].entries()) {
      const draftResponse = await app.request('/api/v1/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceText: `明天上午${index + 9}点${title}`,
          timezone: 'Asia/Shanghai',
          referenceAt: '2026-05-29T02:00:00Z',
          source: 'text',
        }),
      })
      const draftPayload = (await draftResponse.json()) as DraftResponsePayload

      const eventResponse = await app.request('/api/v1/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draftId: draftPayload.data.draft.draftId,
        }),
      })

      expect(eventResponse.status).toBe(200)
    }

    const recentResponse = await app.request('/api/v1/events?mode=recent&limit=2&offset=1')
    const recentPayload = (await recentResponse.json()) as EventListResponsePayload

    expect(recentResponse.status).toBe(200)
    expect(recentPayload.data.total).toBe(3)
    expect(recentPayload.data.items).toHaveLength(2)
    expect(recentPayload.data.items.map((item) => item.title)).toEqual(['事件二', '事件一'])
  })

  test('rejects draft updates when the draft is missing', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts/drf_missing', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: {
          title: '喝咖啡',
        },
      }),
    })
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(404)
    expect(payload.error.code).toBe('NOT_FOUND')
    expect(payload.error.details).toEqual({ draftId: 'drf_missing' })
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
  })

  test('rejects event creation when the draft still has missing fields', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const draftResponse = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天和张总喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const draftPayload = (await draftResponse.json()) as DraftResponsePayload

    const response = await app.request('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draftId: draftPayload.data.draft.draftId,
      }),
    })
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(422)
    expect(payload.error.code).toBe('DRAFT_MISSING_FIELDS')
    expect(payload.error.details).toEqual({
      draftId: draftPayload.data.draft.draftId,
      missingFields: ['startAt'],
    })
    expect(payload.meta.timestamp).toMatch(isoTimestampPattern)
  })

  test('returns recent events using items and total', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/events?mode=recent&limit=5')
    const payload = (await response.json()) as EventListResponsePayload

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({
      items: [],
      total: 0,
    })
  })

  test('rejects unsupported event list modes', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/events?mode=range&limit=5')
    const payload = (await response.json()) as ErrorResponsePayload

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('VALIDATION_ERROR')
  })
})
