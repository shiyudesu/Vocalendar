import type {
  EventRecord,
  NotificationRecord,
  V1EventDraftRecord as EventDraft,
} from '@vocalendar/schemas'

import type {
  EventsRepository,
  NotificationsRepository,
  RealtimeEvent,
  RealtimeRepository,
  VoiceHistoryItem,
  VoiceHistoryRepository,
} from './events.types.js'

type DatabaseQueryLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

type RealtimePublisherLike = {
  publish: (channel: string, message: string) => Promise<unknown>
}

type RealtimeSubscriberLike = {
  subscribe: (channel: string, listener: (message: string) => void) => Promise<unknown>
  unsubscribe: (channel: string) => Promise<unknown>
}

type RealtimePubSubLike = {
  publisher: RealtimePublisherLike
  subscriber: RealtimeSubscriberLike
}

export function createPgEventsRepository(pool: DatabaseQueryLike): EventsRepository {
  return {
    async saveDraft(draft: EventDraft) {
      const result = await pool.query(
        `
          insert into event_drafts (
            id,
            user_id,
            source,
            source_text,
            reference_at,
            normalized_text,
            parsed,
            missing_fields,
            warnings,
            can_save,
            clarification_prompt,
            updated_at
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5::timestamptz,
            $6,
            $7::jsonb,
            $8::jsonb,
            $9::jsonb,
            $10,
            $11,
            now()
          )
          on conflict (id) do update
          set user_id = excluded.user_id,
              source = excluded.source,
              source_text = excluded.source_text,
              reference_at = excluded.reference_at,
              normalized_text = excluded.normalized_text,
              parsed = excluded.parsed,
              missing_fields = excluded.missing_fields,
              warnings = excluded.warnings,
              can_save = excluded.can_save,
              clarification_prompt = excluded.clarification_prompt,
              updated_at = now()
          returning
            id,
            user_id,
            source,
            source_text,
            reference_at,
            normalized_text,
            parsed,
            missing_fields,
            warnings,
            can_save,
            clarification_prompt
        `,
        [
          draft.draftId,
          draft.userId ?? null,
          draft.source,
          draft.sourceText,
          draft.referenceAt,
          draft.normalizedText ?? null,
          JSON.stringify(draft.parsed),
          JSON.stringify(draft.missingFields),
          JSON.stringify(draft.warnings),
          draft.canSave,
          draft.clarificationPrompt,
        ],
      )

      return mapDraft(result.rows[0]) as EventDraft
    },

    async findDraft(draftId: string, userId?: string | null) {
      const result = await pool.query(
        `
          select
            id,
            user_id,
            source,
            source_text,
            reference_at,
            normalized_text,
            parsed,
            missing_fields,
            warnings,
            can_save,
            clarification_prompt
          from event_drafts
          where id = $1
            and ($2::text is null or user_id = $2)
        `,
        [draftId, userId ?? null],
      )

      return mapDraft(result.rows[0])
    },

    async saveEvent(event: EventRecord) {
      const result = await pool.query(
        `
          insert into events (
            id,
            user_id,
            title,
            description,
            start_time,
            end_time,
            all_day,
            timezone,
            location,
            recurrence,
            priority,
            tags,
            source,
            created_at,
            updated_at,
            deleted_at
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5::timestamptz,
            $6::timestamptz,
            $7,
            $8,
            $9,
            $10::jsonb,
            $11,
            $12::jsonb,
            $13,
            $14::timestamptz,
            $15::timestamptz,
            null
          )
          on conflict (id) do update
          set user_id = excluded.user_id,
              title = excluded.title,
              description = excluded.description,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              all_day = excluded.all_day,
              timezone = excluded.timezone,
              location = excluded.location,
              recurrence = excluded.recurrence,
              priority = excluded.priority,
              tags = excluded.tags,
              source = excluded.source,
              updated_at = excluded.updated_at,
              deleted_at = null
          returning
            id,
            user_id,
            title,
            description,
            start_time,
            end_time,
            all_day,
            timezone,
            location,
            recurrence,
            priority,
            tags,
            source,
            created_at,
            updated_at
        `,
        [
          event.id,
          event.userId,
          event.title,
          event.description,
          event.startTime,
          event.endTime,
          event.allDay,
          event.timezone,
          event.location,
          JSON.stringify(event.recurrence),
          event.priority,
          JSON.stringify(event.tags),
          event.source,
          event.createdAt,
          event.updatedAt,
        ],
      )

      await replaceEventReminders(pool, event)
      await replaceEventAttendees(pool, event)

      return (await hydrateEvent(pool, mapEventMainRow(result.rows[0]))) as EventRecord
    },

    async findEvent(eventId: string, userId?: string | null) {
      const result = await pool.query(
        `
          select
            id,
            user_id,
            title,
            description,
            start_time,
            end_time,
            all_day,
            timezone,
            location,
            recurrence,
            priority,
            tags,
            source,
            created_at,
            updated_at
          from events
          where id = $1
            and deleted_at is null
            and ($2::text is null or user_id = $2)
        `,
        [eventId, userId ?? null],
      )

      if (result.rows.length === 0) {
        return null
      }

      return await hydrateEvent(pool, mapEventMainRow(result.rows[0]))
    },

    async listReminderCandidateEvents(input?: { userId?: string | null }) {
      const result = await pool.query(
        `
          select distinct
            e.id,
            e.user_id,
            e.title,
            e.description,
            e.start_time,
            e.end_time,
            e.all_day,
            e.timezone,
            e.location,
            e.recurrence,
            e.priority,
            e.tags,
            e.source,
            e.created_at,
            e.updated_at
          from events e
          inner join event_reminders r on r.event_id = e.id
          where e.deleted_at is null
            and ($1::text is null or e.user_id = $1)
          order by e.start_time asc, e.id asc
        `,
        [input?.userId ?? null],
      )

      return await hydrateEvents(pool, result.rows.map(mapEventMainRow))
    },

    async listEvents(input) {
      const result = await pool.query(
        `
          select
            id,
            user_id,
            title,
            description,
            start_time,
            end_time,
            all_day,
            timezone,
            location,
            recurrence,
            priority,
            tags,
            source,
            created_at,
            updated_at
          from events
          where deleted_at is null
            and ($1::text is null or user_id = $1)
            and ($2::timestamptz is null or start_time >= $2::timestamptz)
            and ($3::timestamptz is null or start_time <= $3::timestamptz)
            and (
              $4::text is null
              or lower(title) like lower($4)
              or lower(coalesce(description, '')) like lower($4)
              or lower(coalesce(location, '')) like lower($4)
              or exists (
                select 1
                from jsonb_array_elements_text(tags) as tag(value)
                where lower(tag.value) like lower($4)
              )
            )
            and ($5::text is null or source = $5)
            and ($6::text is null or priority = $6)
          order by start_time desc, id desc
        `,
        [
          input.userId ?? null,
          input.startDate ?? null,
          input.endDate ?? null,
          input.keyword ? `%${input.keyword}%` : null,
          input.source ?? null,
          input.priority ?? null,
        ],
      )

      const events = await hydrateEvents(pool, result.rows.map(mapEventMainRow))
      const startIndex = input.cursor
        ? Math.max(events.findIndex((event) => event.id === input.cursor) + 1, 0)
        : 0
      const items = events.slice(startIndex, startIndex + input.limit)
      const nextCursor =
        startIndex + input.limit < events.length ? (items.at(-1)?.id ?? null) : null

      return {
        items,
        nextCursor,
      }
    },

    async deleteEvent(eventId: string, userId?: string | null) {
      const timestamp = new Date().toISOString()
      const result = await pool.query(
        `
          update events
          set deleted_at = $3::timestamptz,
              updated_at = $4::timestamptz
          where id = $1
            and deleted_at is null
            and ($2::text is null or user_id = $2)
          returning id
        `,
        [eventId, userId ?? null, timestamp, timestamp],
      )

      return result.rows.length > 0
    },

    async countEvents(userId?: string | null) {
      const result = await pool.query(
        `
          select id
          from events
          where deleted_at is null
            and ($1::text is null or user_id = $1)
        `,
        [userId ?? null],
      )

      return result.rows.length
    },

    reset() {},
  }
}

export function createPgNotificationsRepository(pool: DatabaseQueryLike): NotificationsRepository {
  return {
    async list(userId?: string | null) {
      const result = await pool.query(
        `
          select
            id,
            user_id,
            event_id,
            title,
            message,
            time,
            read,
            snoozed_until
          from notifications
          where deleted_at is null
            and ($1::text is null or user_id = $1)
          order by time desc, id desc
        `,
        [userId ?? null],
      )

      return result.rows
        .map(mapNotification)
        .filter((notification): notification is NotificationRecord => notification !== null)
    },

    async findById(notificationId: string, userId?: string | null) {
      const result = await pool.query(
        `
          select
            id,
            user_id,
            event_id,
            title,
            message,
            time,
            read,
            snoozed_until
          from notifications
          where id = $1
            and deleted_at is null
            and ($2::text is null or user_id = $2)
        `,
        [notificationId, userId ?? null],
      )

      return mapNotification(result.rows[0])
    },

    async create(notification: NotificationRecord, userId?: string | null) {
      if (!userId) {
        throw new Error('userId is required to create notifications')
      }

      const result = await pool.query(
        `
          insert into notifications (
            id,
            user_id,
            event_id,
            title,
            message,
            time,
            read,
            snoozed_until,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8::timestamptz, now())
          returning
            id,
            user_id,
            event_id,
            title,
            message,
            time,
            read,
            snoozed_until
        `,
        [
          notification.id,
          userId,
          null,
          notification.title,
          notification.message,
          notification.time,
          notification.read,
          null,
        ],
      )

      return mapNotification(result.rows[0]) as NotificationRecord
    },

    async update(
      notificationId: string,
      input: Partial<NotificationRecord>,
      userId?: string | null,
    ) {
      const current = await this.findById(notificationId, userId)

      if (!current) {
        return null
      }

      const snoozedUntil = input.time && input.time !== current.time ? input.time : null
      const next = {
        ...current,
        ...input,
      }
      const result = await pool.query(
        `
          update notifications
          set title = $2,
              message = $3,
              time = $4::timestamptz,
              read = $5,
              snoozed_until = $6::timestamptz,
              updated_at = now()
          where id = $1
            and deleted_at is null
            and ($7::text is null or user_id = $7)
          returning
            id,
            user_id,
            event_id,
            title,
            message,
            time,
            read,
            snoozed_until
        `,
        [
          notificationId,
          next.title,
          next.message,
          next.time,
          next.read,
          snoozedUntil,
          userId ?? null,
        ],
      )

      return mapNotification(result.rows[0])
    },

    async delete(notificationId: string, userId?: string | null) {
      const timestamp = new Date().toISOString()
      const result = await pool.query(
        `
          update notifications
          set deleted_at = $3::timestamptz,
              updated_at = now()
          where id = $1
            and deleted_at is null
            and ($2::text is null or user_id = $2)
          returning id
        `,
        [notificationId, userId ?? null, timestamp],
      )

      return result.rows.length > 0
    },

    reset() {},
  }
}

export function createPgVoiceHistoryRepository(pool: DatabaseQueryLike): VoiceHistoryRepository {
  return {
    async add(item: VoiceHistoryItem, userId?: string | null) {
      if (!userId) {
        throw new Error('userId is required to create voice history')
      }

      const result = await pool.query(
        `
          insert into voice_history (
            id,
            user_id,
            kind,
            provider,
            language,
            request_summary,
            result_summary,
            created_at
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::timestamptz)
          returning
            id,
            user_id,
            kind,
            provider,
            language,
            request_summary,
            result_summary,
            created_at
        `,
        [
          item.id,
          userId,
          item.kind,
          item.provider,
          item.language,
          JSON.stringify(item.requestSummary),
          JSON.stringify(item.resultSummary),
          item.createdAt,
        ],
      )

      return mapVoiceHistoryItem(result.rows[0]) as VoiceHistoryItem
    },

    async list(userId?: string | null) {
      if (!userId) {
        return []
      }

      const result = await pool.query(
        `
          select
            id,
            user_id,
            kind,
            provider,
            language,
            request_summary,
            result_summary,
            created_at
          from voice_history
          where user_id = $1
          order by created_at desc, id desc
        `,
        [userId],
      )

      return result.rows
        .map(mapVoiceHistoryItem)
        .filter((item): item is VoiceHistoryItem => item !== null)
    },

    reset() {},
  }
}

export function createPgRealtimeRepository(
  pool: DatabaseQueryLike,
  pubsub?: RealtimePubSubLike,
): RealtimeRepository {
  const listeners = new Map<string, Set<(event: RealtimeEvent) => void>>()

  return {
    async push(event: RealtimeEvent, userId?: string | null) {
      if (!userId) {
        throw new Error('userId is required to create realtime events')
      }

      await pool.query(
        `
          insert into realtime_outbox (user_id, topic, payload, created_at)
          values ($1, $2, $3::jsonb, $4::timestamptz)
        `,
        [userId, event.type, JSON.stringify(event.payload), event.createdAt],
      )

      if (pubsub) {
        await pubsub.publisher.publish(realtimeChannel(userId), JSON.stringify(event))
      } else {
        for (const listener of listeners.get(userId) ?? []) {
          listener(event)
        }
      }

      return event
    },

    async list(userId?: string | null) {
      if (!userId) {
        return []
      }

      const result = await pool.query(
        `
          select id, user_id, topic, payload, created_at
          from realtime_outbox
          where user_id = $1
          order by created_at desc, id desc
        `,
        [userId],
      )

      return result.rows.map(mapRealtimeEvent)
    },

    async subscribe(listener: (event: RealtimeEvent) => void, userId?: string | null) {
      if (!userId) {
        return () => {}
      }

      const scopedListeners = listeners.get(userId) ?? new Set<(event: RealtimeEvent) => void>()
      const shouldRegisterRemoteSubscription = scopedListeners.size === 0

      scopedListeners.add(listener)
      listeners.set(userId, scopedListeners)

      if (pubsub && shouldRegisterRemoteSubscription) {
        await pubsub.subscriber.subscribe(realtimeChannel(userId), (message) => {
          const nextEvent = parseRealtimeEventMessage(message)

          if (!nextEvent) {
            return
          }

          for (const nextListener of listeners.get(userId) ?? []) {
            nextListener(nextEvent)
          }
        })
      }

      return () => {
        scopedListeners.delete(listener)

        if (scopedListeners.size === 0) {
          listeners.delete(userId)
          if (pubsub) {
            void pubsub.subscriber.unsubscribe(realtimeChannel(userId))
          }
        }
      }
    },

    reset() {},
  }
}

async function replaceEventReminders(pool: DatabaseQueryLike, event: EventRecord) {
  await pool.query('delete from event_reminders where event_id = $1', [event.id])

  for (const reminder of event.reminders) {
    await pool.query(
      `
        insert into event_reminders (id, event_id, minutes_before, method, sent_at, updated_at)
        values ($1, $2, $3, $4, $5::timestamptz, now())
      `,
      [reminder.id, event.id, reminder.minutesBefore, reminder.method, reminder.sentAt],
    )
  }
}

async function replaceEventAttendees(pool: DatabaseQueryLike, event: EventRecord) {
  await pool.query('delete from event_attendees where event_id = $1', [event.id])

  for (const attendee of event.attendees) {
    await pool.query(
      `
        insert into event_attendees (id, event_id, name, email, status, updated_at)
        values ($1, $2, $3, $4, $5, now())
      `,
      [attendee.id, event.id, attendee.name, attendee.email, attendee.status],
    )
  }
}

async function hydrateEvent(pool: DatabaseQueryLike, mainRow: EventMainRow | null) {
  if (!mainRow) {
    return null
  }

  const [hydrated] = await hydrateEvents(pool, [mainRow])

  return hydrated ?? null
}

async function hydrateEvents(pool: DatabaseQueryLike, mainRows: EventMainRow[]) {
  if (mainRows.length === 0) {
    return []
  }

  const eventIds = mainRows.map((row) => row.id)
  const reminderResult = await pool.query(
    `
      select id, event_id, minutes_before, method, sent_at
      from event_reminders
      where event_id = any($1::text[])
    `,
    [eventIds],
  )
  const attendeeResult = await pool.query(
    `
      select id, event_id, name, email, status
      from event_attendees
      where event_id = any($1::text[])
    `,
    [eventIds],
  )

  const remindersByEventId = new Map<string, EventRecord['reminders']>()
  for (const row of reminderResult.rows) {
    const item = remindersByEventId.get(String(row.event_id)) ?? []

    item.push({
      id: String(row.id),
      eventId: String(row.event_id),
      minutesBefore: Number(row.minutes_before),
      method: row.method as EventRecord['reminders'][number]['method'],
      sentAt: nullableTimestamp(row.sent_at),
    })
    remindersByEventId.set(String(row.event_id), item)
  }

  const attendeesByEventId = new Map<string, EventRecord['attendees']>()
  for (const row of attendeeResult.rows) {
    const item = attendeesByEventId.get(String(row.event_id)) ?? []

    item.push({
      id: String(row.id),
      name: String(row.name),
      email: nullableString(row.email),
      status: row.status as EventRecord['attendees'][number]['status'],
    })
    attendeesByEventId.set(String(row.event_id), item)
  }

  return mainRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    allDay: row.allDay,
    timezone: row.timezone,
    location: row.location,
    recurrence: row.recurrence,
    reminders: remindersByEventId.get(row.id) ?? [],
    attendees: attendeesByEventId.get(row.id) ?? [],
    priority: row.priority,
    tags: row.tags,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

type EventMainRow = {
  id: string
  userId: string
  title: string
  description: string | null
  startTime: string
  endTime: string | null
  allDay: boolean
  timezone: string
  location: string | null
  recurrence: EventRecord['recurrence']
  priority: EventRecord['priority']
  tags: string[]
  source: EventRecord['source']
  createdAt: string
  updatedAt: string
}

function mapDraft(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null
  }

  return {
    draftId: String(row.id),
    userId: nullableString(row.user_id),
    source: row.source as EventDraft['source'],
    sourceText: String(row.source_text),
    referenceAt: timestampString(row.reference_at),
    normalizedText: row.normalized_text == null ? undefined : String(row.normalized_text),
    parsed: parseJson<EventDraft['parsed']>(row.parsed),
    missingFields: parseJson<string[]>(row.missing_fields),
    warnings: parseJson<string[]>(row.warnings),
    canSave: Boolean(row.can_save),
    clarificationPrompt: nullableString(row.clarification_prompt),
  } satisfies EventDraft
}

function mapEventMainRow(row: Record<string, unknown>): EventMainRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    description: nullableString(row.description),
    startTime: timestampString(row.start_time),
    endTime: nullableTimestamp(row.end_time),
    allDay: Boolean(row.all_day),
    timezone: String(row.timezone),
    location: nullableString(row.location),
    recurrence: parseNullableJson<EventRecord['recurrence']>(row.recurrence),
    priority: row.priority as EventRecord['priority'],
    tags: parseJson<string[]>(row.tags),
    source: row.source as EventRecord['source'],
    createdAt: timestampString(row.created_at),
    updatedAt: timestampString(row.updated_at),
  }
}

function mapNotification(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    title: String(row.title),
    message: String(row.message),
    time: timestampString(row.time),
    read: Boolean(row.read),
  } satisfies NotificationRecord
}

function mapVoiceHistoryItem(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null
  }

  return {
    id: String(row.id),
    kind: row.kind as VoiceHistoryItem['kind'],
    provider: String(row.provider),
    language: String(row.language),
    requestSummary: parseJson<Record<string, unknown>>(row.request_summary),
    resultSummary: parseJson<Record<string, unknown>>(row.result_summary),
    createdAt: timestampString(row.created_at),
  } satisfies VoiceHistoryItem
}

function mapRealtimeEvent(row: Record<string, unknown>) {
  return {
    type: String(row.topic),
    payload: parseJson<unknown>(row.payload),
    createdAt: timestampString(row.created_at),
  } satisfies RealtimeEvent
}

function parseJson<T>(value: unknown) {
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }

  return value as T
}

function parseNullableJson<T>(value: unknown) {
  if (value == null) {
    return null
  }

  return parseJson<T>(value)
}

function nullableString(value: unknown) {
  return value == null ? null : String(value)
}

function timestampString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}

function nullableTimestamp(value: unknown) {
  return value == null ? null : timestampString(value)
}

function realtimeChannel(userId: string) {
  return `vocalendar:realtime:${userId}`
}

function parseRealtimeEventMessage(message: string) {
  try {
    return JSON.parse(message) as RealtimeEvent
  } catch {
    return null
  }
}
