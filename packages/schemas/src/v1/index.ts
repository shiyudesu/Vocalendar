import { z } from 'zod'

function isValidIanaTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

const isoDateTimeSchema = z.string().datetime()
const timezoneSchema = z.string().min(1).refine(isValidIanaTimezone, {
  message: 'Invalid IANA timezone.',
})
const eventSourceSchema = z.enum(['voice', 'manual'])
const eventPrioritySchema = z.enum(['low', 'normal', 'high'])
const reminderMethodSchema = z.enum(['push', 'email', 'sms'])
const attendeeStatusSchema = z.enum(['pending', 'accepted', 'declined'])
const nullableTrimmedStringSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return typeof value === 'string' ? value.trim() : value
}, z.string().min(1).nullable())

function parseNullableDatetime(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return value
}

function parseNullableString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return value
}

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).default(1),
  byWeekDay: z.array(z.number().int().min(0).max(6)).default([]),
  byMonthDay: z.array(z.number().int().min(1).max(31)).default([]),
  until: isoDateTimeSchema.nullable(),
  count: z.number().int().min(1).nullable(),
  exclusions: z.array(isoDateTimeSchema).default([]),
})

export const reminderRecordSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  minutesBefore: z.number().int().min(0),
  method: reminderMethodSchema,
  sentAt: isoDateTimeSchema.nullable(),
})

export const attendeeRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email().nullable(),
  status: attendeeStatusSchema,
})

export const eventRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema.nullable(),
  allDay: z.boolean().default(false),
  timezone: timezoneSchema,
  location: z.string().min(1).nullable(),
  recurrence: recurrenceRuleSchema.nullable(),
  reminders: z.array(reminderRecordSchema),
  attendees: z.array(attendeeRecordSchema),
  priority: eventPrioritySchema,
  tags: z.array(z.string().min(1)),
  source: eventSourceSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const eventListQuerySchema = z
  .object({
    startDate: z.preprocess(parseNullableDatetime, isoDateTimeSchema.nullable().default(null)),
    endDate: z.preprocess(parseNullableDatetime, isoDateTimeSchema.nullable().default(null)),
    timezone: z.preprocess(parseNullableString, timezoneSchema.nullable().default(null)),
    keyword: nullableTrimmedStringSchema.default(null),
    source: z.preprocess(parseNullableString, eventSourceSchema.nullable().default(null)),
    priority: z.preprocess(parseNullableString, eventPrioritySchema.nullable().default(null)),
    cursor: nullableTrimmedStringSchema.default(null),
    limit: z.preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(100).default(20),
    ),
  })
  .strict()

export const updateEventRequestSchema = eventRecordSchema
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    recurrenceScope: z.enum(['single', 'following', 'all']).optional(),
    occurrenceStartTime: z.preprocess(parseNullableDatetime, isoDateTimeSchema.optional()),
  })
  .superRefine((value, ctx) => {
    if (
      (value.recurrenceScope === 'single' || value.recurrenceScope === 'following') &&
      !value.occurrenceStartTime
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurrenceStartTime'],
        message: 'occurrenceStartTime is required for scoped recurring event updates.',
      })
    }
  })

export const batchDeleteEventsRequestSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
})

export const deleteEventQuerySchema = z
  .object({
    recurrenceScope: z.enum(['single', 'following', 'all']).optional(),
    occurrenceStartTime: z.preprocess(parseNullableDatetime, isoDateTimeSchema.optional()),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.recurrenceScope === 'single' || value.recurrenceScope === 'following') &&
      !value.occurrenceStartTime
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurrenceStartTime'],
        message: 'occurrenceStartTime is required for scoped recurring event deletes.',
      })
    }
  })

export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  defaultView: z.enum(['day', 'week', 'month', 'list']),
  defaultReminderMinutes: z.number().int().min(0),
  voiceFeedback: z.boolean(),
  voiceSpeed: z.number().positive(),
  language: z.string().min(1),
})

export const updateUserSettingsRequestSchema = userSettingsSchema
  .partial()
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one setting must be provided.',
      })
    }
  })

export const authRegisterRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
})

export const authLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const authRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})

export const userProfileSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1),
  settings: userSettingsSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export const updateCurrentUserProfileRequestSchema = z
  .object({
    email: z.email().optional(),
    name: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one profile field must be provided.',
      })
    }
  })

export const notificationRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  time: isoDateTimeSchema,
  read: z.boolean(),
})

export const voiceAsrWsStartMessageSchema = z.object({
  type: z.literal('session.start'),
  audioFormat: z.literal('pcm'),
  sampleRate: z.literal(16000),
  language: z.string().min(1),
  enableIntermediateResult: z.boolean(),
  enablePunctuation: z.boolean(),
  enableInverseTextNormalization: z.boolean(),
})

export const exportDataQuerySchema = z.object({
  format: z.enum(['ics', 'csv']),
})

export const cursorPageMetaSchema = z.object({
  nextCursor: nullableTrimmedStringSchema,
})

export const draftSourceSchema = z.enum(['text', 'voice'])

export const v1EventDraftParsedSchema = z.object({
  title: z.string().min(1).nullable(),
  startAt: isoDateTimeSchema.nullable(),
  endAt: isoDateTimeSchema.nullable(),
  timezone: timezoneSchema,
  location: z.string().min(1).nullable(),
  participants: z.array(z.string().min(1)),
})

export const v1EventDraftRecordSchema = z.object({
  draftId: z.string().min(1),
  userId: z.string().min(1).nullable().optional(),
  sourceText: z.string().min(1),
  source: draftSourceSchema,
  referenceAt: isoDateTimeSchema,
  normalizedText: z.string().optional(),
  parsed: v1EventDraftParsedSchema,
  missingFields: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1)),
  canSave: z.boolean(),
  clarificationPrompt: z.string().nullable(),
})

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>
export type ReminderRecord = z.infer<typeof reminderRecordSchema>
export type AttendeeRecord = z.infer<typeof attendeeRecordSchema>
export type EventRecord = z.infer<typeof eventRecordSchema>
export type EventListQuery = z.infer<typeof eventListQuerySchema>
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>
export type BatchDeleteEventsRequest = z.infer<typeof batchDeleteEventsRequestSchema>
export type DeleteEventQuery = z.infer<typeof deleteEventQuerySchema>
export type UserSettings = z.infer<typeof userSettingsSchema>
export type UpdateUserSettingsRequest = z.infer<typeof updateUserSettingsRequestSchema>
export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>
export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>
export type AuthRefreshRequest = z.infer<typeof authRefreshRequestSchema>
export type NotificationRecord = z.infer<typeof notificationRecordSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
export type UpdateCurrentUserProfileRequest = z.infer<typeof updateCurrentUserProfileRequestSchema>
export type VoiceAsrWsStartMessage = z.infer<typeof voiceAsrWsStartMessageSchema>
export type ExportDataQuery = z.infer<typeof exportDataQuerySchema>
export type CursorPageMeta = z.infer<typeof cursorPageMetaSchema>
export type V1EventDraftParsed = z.infer<typeof v1EventDraftParsedSchema>
export type V1EventDraftRecord = z.infer<typeof v1EventDraftRecordSchema>
