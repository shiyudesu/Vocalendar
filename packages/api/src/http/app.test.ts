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
    items: unknown[]
    total: number
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
