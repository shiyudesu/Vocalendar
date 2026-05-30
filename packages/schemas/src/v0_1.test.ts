import { describe, expect, test } from 'vitest'

import {
  eventListItemSchema,
  eventSchema,
  listEventsQuerySchema,
  queryRequestSchema,
  updateDraftRequestSchema,
} from './v0_1.js'

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
  test('defaults to recent mode with limit 20 and offset 0', () => {
    const result = listEventsQuerySchema.parse({})

    expect(result).toEqual({ mode: 'recent', limit: 20, offset: 0 })
  })

  test('coerces pagination query strings and caps the maximum limit at 100', () => {
    const result = listEventsQuerySchema.parse({
      mode: 'recent',
      limit: '101',
      offset: '12',
    })

    expect(result).toEqual({ mode: 'recent', limit: 100, offset: 12 })
  })

  test('rejects non-recent modes in v0.1', () => {
    const result = listEventsQuerySchema.safeParse({
      mode: 'range',
    })

    expect(result.success).toBe(false)
  })
})

describe('queryRequestSchema', () => {
  test('accepts predeclared range query parameters', () => {
    const result = queryRequestSchema.parse({
      range: 'week',
      keyword: '咖啡',
      limit: '30',
      offset: '5',
    })

    expect(result).toEqual({
      range: 'week',
      keyword: '咖啡',
      limit: 30,
      offset: 5,
    })
  })

  test('requires at least one range anchor', () => {
    const result = queryRequestSchema.safeParse({
      keyword: '咖啡',
    })

    expect(result.success).toBe(false)
  })
})

describe('event schemas', () => {
  test('accepts the predeclared event status variants', () => {
    const cancelled = eventSchema.safeParse({
      id: 'evt_123',
      title: '喝咖啡',
      description: null,
      startAt: '2026-05-30T07:00:00Z',
      endAt: null,
      timezone: 'Asia/Shanghai',
      location: '国贸',
      participants: ['张总'],
      source: 'text',
      status: 'cancelled',
      createdAt: '2026-05-29T10:00:00Z',
      updatedAt: '2026-05-29T10:00:00Z',
    })

    expect(cancelled.success).toBe(true)
  })

  test('accepts event list items defined in the API contract', () => {
    const result = eventListItemSchema.safeParse({
      id: 'evt_123',
      title: '喝咖啡',
      startAt: '2026-05-30T07:00:00Z',
      endAt: null,
      timezone: 'Asia/Shanghai',
      location: '国贸',
    })

    expect(result.success).toBe(true)
  })
})
