import { z } from 'zod'

export const eventSourceSchema = z.enum(['text', 'voice'])

function isValidIanaTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

const timezoneSchema = z.string().min(1).refine(isValidIanaTimezone, {
  message: 'Invalid IANA timezone.',
})

export const eventDraftParsedSchema = z.object({
  title: z.string().min(1).nullable(),
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  timezone: timezoneSchema,
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

export const eventStatusSchema = z.enum(['confirmed', 'cancelled', 'draft'])

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  timezone: timezoneSchema,
  location: z.string().min(1).nullable(),
  participants: z.array(z.string().min(1)),
  source: eventSourceSchema,
  status: eventStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const eventListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  timezone: timezoneSchema,
  location: z.string().min(1).nullable(),
})

export const createDraftRequestSchema = z.object({
  sourceText: z.string().min(1),
  timezone: timezoneSchema,
  referenceAt: z.string().datetime(),
  source: eventSourceSchema.default('text'),
})

export const createEventRequestSchema = z.object({
  draftId: z.string().min(1),
})

export const updateDraftFieldsSchema = z
  .object({
    title: z.string().min(1).nullable().optional(),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    timezone: timezoneSchema.optional(),
    location: z.string().min(1).nullable().optional(),
    participants: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, {
    message: 'At least one draft field must be provided.',
  })

export const updateDraftRequestSchema = z
  .object({
    userInput: z.string().trim().min(1).optional(),
    referenceAt: z.string().datetime().optional(),
    fields: updateDraftFieldsSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.userInput && !value.fields) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either userInput or fields must be provided.',
      })
    }

    if (value.userInput && !value.referenceAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'referenceAt is required when userInput is provided.',
        path: ['referenceAt'],
      })
    }
  })

export const listEventsQuerySchema = z.object({
  mode: z.literal('recent').default('recent'),
  limit: z
    .preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).default(20),
    )
    .transform((limit) => Math.min(limit, 100)),
  offset: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(0).default(0),
  ),
})

export const queryRangeSchema = z.enum(['today', 'tomorrow', 'week', 'month'])

export const queryRequestSchema = z
  .object({
    range: queryRangeSchema.nullable().optional(),
    from: z.string().datetime().nullable().optional(),
    to: z.string().datetime().nullable().optional(),
    keyword: z.string().trim().min(1).nullable().optional(),
    limit: z.preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(100).default(20),
    ),
    offset: z.preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(0).default(0),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.range && !value.from && !value.to) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of range, from, or to is required.',
        path: ['range'],
      })
    }
  })

export type EventDraftParsed = z.infer<typeof eventDraftParsedSchema>
export type EventDraft = z.infer<typeof eventDraftSchema>
export type Event = z.infer<typeof eventSchema>
export type EventListItem = z.infer<typeof eventListItemSchema>
export type CreateDraftRequest = z.infer<typeof createDraftRequestSchema>
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>
export type UpdateDraftFields = z.infer<typeof updateDraftFieldsSchema>
export type UpdateDraftRequest = z.infer<typeof updateDraftRequestSchema>
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>
export type QueryRequest = z.infer<typeof queryRequestSchema>
