import { z } from 'zod'

import { isoDateTimeSchema, timezoneSchema } from './common.js'

export const chatMessageRoleSchema = z.enum(['user', 'assistant'])

export const chatMessageTypeSchema = z.enum(['text', 'voice'])

export const chatMessageSchema = z.object({
  role: chatMessageRoleSchema,
  content: z.string().min(1),
  type: chatMessageTypeSchema.default('text'),
})

export const assistantActionTypeSchema = z.enum(['create', 'update', 'delete', 'query', 'clarify'])

export const assistantActionStatusSchema = z.enum(['pending', 'confirmed', 'executed', 'cancelled'])

export const eventDraftForActionSchema = z.object({
  title: z.string().min(1).nullable(),
  startAt: isoDateTimeSchema.nullable(),
  endAt: isoDateTimeSchema.nullable(),
  timezone: timezoneSchema,
  location: z.string().min(1).nullable(),
  participants: z.array(z.string().min(1)),
})

export const assistantActionSchema = z.object({
  id: z.string().min(1),
  type: assistantActionTypeSchema,
  status: assistantActionStatusSchema.default('pending'),
  eventDraft: eventDraftForActionSchema.nullable().optional(),
  targetEventId: z.string().min(1).nullable().optional(),
  changes: z.record(z.string(), z.unknown()).nullable().optional(),
  question: z.string().min(1).optional(),
})

export const recentEventContextSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startTime: isoDateTimeSchema,
  location: z.string().nullable(),
})

export const assistantChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
  timezone: timezoneSchema,
  referenceAt: isoDateTimeSchema,
  recentEvents: z.array(recentEventContextSchema).max(10).default([]),
})

export const assistantReplySchema = z.object({
  role: z.literal('assistant'),
  content: z.string().min(1),
})

export const assistantChatResponseSchema = z.object({
  reply: assistantReplySchema,
  actions: z.array(assistantActionSchema).default([]),
  needsConfirmation: z.boolean().default(false),
})

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>
export type ChatMessageType = z.infer<typeof chatMessageTypeSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type AssistantActionType = z.infer<typeof assistantActionTypeSchema>
export type AssistantActionStatus = z.infer<typeof assistantActionStatusSchema>
export type EventDraftForAction = z.infer<typeof eventDraftForActionSchema>
export type AssistantAction = z.infer<typeof assistantActionSchema>
export type RecentEventContext = z.infer<typeof recentEventContextSchema>
export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>
export type AssistantReply = z.infer<typeof assistantReplySchema>
export type AssistantChatResponse = z.infer<typeof assistantChatResponseSchema>
