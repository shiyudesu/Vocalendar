import { z } from 'zod'

export const eventSourceSchema = z.enum(['text', 'voice'])

export const eventDraftParsedSchema = z.object({
  title: z.string().min(1).nullable(),
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  timezone: z.string().min(1),
  location: z.string().min(1).nullable(),
  participants: z.array(z.string().min(1)),
})

export const eventDraftSchema = z.object({
  draftId: z.string().min(1),
  sourceText: z.string().min(1),
  source: eventSourceSchema,
  referenceAt: z.string().datetime(),
  normalizedText: z.string().optional(),
  parsed: eventDraftParsedSchema,
  missingFields: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  canSave: z.boolean(),
  clarificationPrompt: z.string().nullable(),
})

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  timezone: z.string().min(1),
  location: z.string().min(1).nullable(),
  participants: z.array(z.string().min(1)),
  source: eventSourceSchema,
  status: z.literal('confirmed'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createDraftRequestSchema = z.object({
  sourceText: z.string().min(1),
  timezone: z.string().min(1),
  referenceAt: z.string().datetime(),
  source: eventSourceSchema.default('text'),
})

export const createEventRequestSchema = z.object({
  draftId: z.string().min(1),
})

export type EventDraftParsed = z.infer<typeof eventDraftParsedSchema>
export type EventDraft = z.infer<typeof eventDraftSchema>
export type Event = z.infer<typeof eventSchema>
export type CreateDraftRequest = z.infer<typeof createDraftRequestSchema>
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>
