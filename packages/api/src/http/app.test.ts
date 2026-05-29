import { describe, expect, test } from 'vitest'

import { eventMemoryRepository } from '../repositories/events.memory.js'
import { createApp } from './app.js'

type DraftResponsePayload = {
  data: {
    draft: {
      parsed: {
        startAt: string | null
      }
      missingFields: string[]
      canSave: boolean
    }
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
  }
}

describe('v0.1 API contract', () => {
  test('keeps a date-only draft unsavable instead of guessing startAt', async () => {
    eventMemoryRepository.reset()
    const app = createApp()

    const response = await app.request('/api/v1/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceText: '明天喝咖啡',
        timezone: 'Asia/Shanghai',
        referenceAt: '2026-05-29T02:00:00Z',
        source: 'text',
      }),
    })
    const payload = (await response.json()) as DraftResponsePayload

    expect(response.status).toBe(200)
    expect(payload.data.draft.parsed.startAt).toBeNull()
    expect(payload.data.draft.missingFields).toContain('startAt')
    expect(payload.data.draft.canSave).toBe(false)
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
