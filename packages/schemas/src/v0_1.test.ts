import { describe, expect, test } from 'vitest'

import { listEventsQuerySchema, updateDraftRequestSchema } from './v0_1.js'

describe('updateDraftRequestSchema', () => {
  test('accepts natural language refinement with referenceAt', () => {
    const result = updateDraftRequestSchema.safeParse({
      userInput: '下午三点开始',
      referenceAt: '2026-05-29T02:05:00Z',
    })

    expect(result.success).toBe(true)
  })

  test('accepts direct field updates for editable draft fields', () => {
    const result = updateDraftRequestSchema.safeParse({
      fields: {
        title: '喝咖啡',
        startAt: '2026-05-30T07:00:00Z',
        endAt: null,
        timezone: 'Asia/Shanghai',
        location: '国贸',
        participants: ['张总'],
      },
    })

    expect(result.success).toBe(true)
  })

  test('requires userInput or fields', () => {
    const result = updateDraftRequestSchema.safeParse({})

    expect(result.success).toBe(false)
  })

  test('requires referenceAt when userInput is present', () => {
    const result = updateDraftRequestSchema.safeParse({
      userInput: '下午三点开始',
    })

    expect(result.success).toBe(false)
  })
})

describe('listEventsQuerySchema', () => {
  test('defaults to recent mode and a limit of 5', () => {
    const result = listEventsQuerySchema.parse({})

    expect(result).toEqual({ mode: 'recent', limit: 5 })
  })

  test('coerces the limit query string and caps the maximum at 10', () => {
    const result = listEventsQuerySchema.parse({
      mode: 'recent',
      limit: '11',
    })

    expect(result).toEqual({ mode: 'recent', limit: 10 })
  })

  test('rejects non-recent modes in v0.1', () => {
    const result = listEventsQuerySchema.safeParse({
      mode: 'range',
    })

    expect(result.success).toBe(false)
  })
})
