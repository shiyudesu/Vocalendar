import type {
  EventRecord,
  NotificationRecord,
  V1EventDraftRecord as EventDraft,
} from '@vocalendar/schemas'

export type EventsRepository = {
  saveDraft(draft: EventDraft): Promise<EventDraft>
  findDraft(draftId: string, userId?: string | null): Promise<EventDraft | null>
  saveEvent(event: EventRecord): Promise<EventRecord>
  findEvent(eventId: string, userId?: string | null): Promise<EventRecord | null>
  listReminderCandidateEvents(input?: { userId?: string | null }): Promise<EventRecord[]>
  listEvents(input: {
    userId?: string | null
    cursor: string | null
    limit: number
    startDate?: string | null
    endDate?: string | null
    keyword?: string | null
    source?: EventRecord['source'] | null
    priority?: EventRecord['priority'] | null
  }): Promise<{
    items: EventRecord[]
    nextCursor: string | null
  }>
  deleteEvent(eventId: string, userId?: string | null): Promise<boolean>
  countEvents(userId?: string | null): Promise<number>
  reset(): void | Promise<void>
}

export type NotificationsRepository = {
  list(userId?: string | null): Promise<NotificationRecord[]>
  findById(notificationId: string, userId?: string | null): Promise<NotificationRecord | null>
  create(notification: NotificationRecord, userId?: string | null): Promise<NotificationRecord>
  update(
    notificationId: string,
    input: Partial<NotificationRecord>,
    userId?: string | null,
  ): Promise<NotificationRecord | null>
  delete(notificationId: string, userId?: string | null): Promise<boolean>
  reset(): void | Promise<void>
}

export type RealtimeEvent = {
  type: string
  payload: unknown
  createdAt: string
}

export type RealtimeRepository = {
  push(event: RealtimeEvent, userId?: string | null): Promise<RealtimeEvent>
  list(userId?: string | null): Promise<RealtimeEvent[]>
  subscribe(listener: (event: RealtimeEvent) => void, userId?: string | null): Promise<() => void>
  reset(): void | Promise<void>
}

export type VoiceHistoryItem = {
  id: string
  kind: 'asr' | 'tts'
  provider: string
  language: string
  requestSummary: Record<string, unknown>
  resultSummary: Record<string, unknown>
  createdAt: string
}

export type VoiceHistoryRepository = {
  add(item: VoiceHistoryItem, userId?: string | null): Promise<VoiceHistoryItem>
  list(userId?: string | null): Promise<VoiceHistoryItem[]>
  reset(): void | Promise<void>
}
