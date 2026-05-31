import type { DeleteEventQuery, EventRecord, UpdateEventRequest } from '@vocalendar/schemas'

import type {
  EventsRepository,
  NotificationsRepository,
  RealtimeRepository,
} from '../../repositories/events.types.js'
import type { UsersRepository } from '../../repositories/users.types.js'
import { nowIso } from '../../utils/clock.js'
import { draftToEventRecord } from './event-mapper.js'

type EventDependencies = {
  eventsRepository: EventsRepository
  notificationsRepository: NotificationsRepository
  realtimeRepository: RealtimeRepository
  usersRepository: UsersRepository
}

export type CreateEventFromDraftResult =
  | {
      ok: true
      event: EventRecord
    }
  | {
      ok: false
      reason: 'not_found'
    }
  | {
      ok: false
      reason: 'missing_fields'
      missingFields: string[]
    }

export type CreateEventDirectlyInput = {
  title: string
  startTime: string
  endTime: string | null
  timezone: string
  location: string | null
  source: 'text' | 'voice'
}

export async function createEventDirectly(
  input: CreateEventDirectlyInput,
  dependencies: EventDependencies,
  userId?: string | null,
): Promise<{ ok: true; event: EventRecord }> {
  const timestamp = nowIso()
  const eventId = `evt_${crypto.randomUUID()}`

  const user = userId ? await dependencies.usersRepository.findUserById(userId) : null

  const event: EventRecord = {
    id: eventId,
    userId: userId ?? 'usr_dev',
    title: input.title,
    description: null,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: false,
    timezone: input.timezone,
    location: input.location,
    recurrence: null,
    reminders: [
      {
        id: `rem_${crypto.randomUUID()}`,
        eventId,
        minutesBefore: user?.settings.defaultReminderMinutes ?? 15,
        method: 'push',
        sentAt: null,
      },
    ],
    attendees: [],
    priority: 'normal',
    tags: [],
    source: input.source === 'voice' ? 'voice' : 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const saved = await dependencies.eventsRepository.saveEvent(event)

  await dependencies.realtimeRepository.push(
    {
      type: 'event.created',
      payload: { eventId: saved.id },
      createdAt: nowIso(),
    },
    saved.userId,
  )

  return {
    ok: true,
    event: saved,
  }
}

export async function createEventFromDraft(
  draftId: string,
  dependencies: EventDependencies,
  userId?: string | null,
): Promise<CreateEventFromDraftResult> {
  const draft = await dependencies.eventsRepository.findDraft(draftId, userId)

  if (!draft) {
    return {
      ok: false,
      reason: 'not_found',
    }
  }

  if (!draft.canSave || !draft.parsed.title || !draft.parsed.startAt) {
    return {
      ok: false,
      reason: 'missing_fields',
      missingFields: draft.missingFields,
    }
  }

  const user = userId ? await dependencies.usersRepository.findUserById(userId) : null
  const event = draftToEventRecord(
    draft,
    user
      ? {
          defaultReminderMinutes: user.settings.defaultReminderMinutes,
        }
      : undefined,
  )
  const saved = await dependencies.eventsRepository.saveEvent(event)

  await dependencies.realtimeRepository.push(
    {
      type: 'event.created',
      payload: { eventId: saved.id },
      createdAt: nowIso(),
    },
    saved.userId,
  )

  return {
    ok: true,
    event: saved,
  }
}

export async function listEvents(
  input: {
    limit: number
    cursor: string | null
    startDate?: string | null
    endDate?: string | null
    keyword?: string | null
    source?: EventRecord['source'] | null
    priority?: EventRecord['priority'] | null
  },
  dependencies: EventDependencies,
  userId?: string | null,
) {
  return await dependencies.eventsRepository.listEvents({
    limit: Math.min(Math.max(input.limit, 1), 100),
    cursor: input.cursor,
    userId,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    keyword: input.keyword ?? null,
    source: input.source ?? null,
    priority: input.priority ?? null,
  })
}

export async function getEvent(
  eventId: string,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  return await dependencies.eventsRepository.findEvent(eventId, userId)
}

export async function updateEvent(
  eventId: string,
  event: UpdateEventRequest,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return null
  }

  const saved = await applyRecurringEventUpdate(current, event, dependencies)

  await dependencies.realtimeRepository.push(
    {
      type: 'event.updated',
      payload: { eventId: saved.id },
      createdAt: nowIso(),
    },
    saved.userId,
  )

  return saved
}

export async function deleteEvent(
  eventId: string,
  query: DeleteEventQuery,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return false
  }

  const result = await applyRecurringEventDelete(current, query, dependencies, userId)

  if (result.ok) {
    await dependencies.realtimeRepository.push(
      {
        type: result.realtimeType,
        payload: { eventId: result.eventId },
        createdAt: nowIso(),
      },
      current.userId,
    )
  }

  return result.ok
}

export async function replaceEventReminders(
  eventId: string,
  reminders: EventRecord['reminders'],
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return null
  }

  const updated: EventRecord = {
    ...current,
    reminders,
    updatedAt: nowIso(),
  }

  const saved = await dependencies.eventsRepository.saveEvent(updated)

  await dependencies.realtimeRepository.push(
    {
      type: 'event.updated',
      payload: { eventId: saved.id },
      createdAt: nowIso(),
    },
    saved.userId,
  )

  return saved
}

export async function addAttendee(
  eventId: string,
  attendee: {
    name: string
    email: string | null
  },
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return null
  }

  const nextAttendee: EventRecord['attendees'][number] = {
    id: `att_${crypto.randomUUID()}`,
    name: attendee.name,
    email: attendee.email,
    status: 'pending',
  }
  const updated: EventRecord = {
    ...current,
    attendees: [...current.attendees, nextAttendee],
    updatedAt: nowIso(),
  }

  await dependencies.eventsRepository.saveEvent(updated)

  await dependencies.realtimeRepository.push(
    {
      type: 'event.updated',
      payload: { eventId: current.id },
      createdAt: nowIso(),
    },
    current.userId,
  )

  return nextAttendee
}

export async function updateAttendeeStatus(
  eventId: string,
  attendeeId: string,
  status: EventRecord['attendees'][number]['status'],
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return null
  }

  const nextAttendees = current.attendees.map((attendee) =>
    attendee.id === attendeeId ? { ...attendee, status } : attendee,
  )
  const updatedAttendee = nextAttendees.find((attendee) => attendee.id === attendeeId)

  if (!updatedAttendee) {
    return null
  }

  await dependencies.eventsRepository.saveEvent({
    ...current,
    attendees: nextAttendees,
    updatedAt: nowIso(),
  })

  await dependencies.realtimeRepository.push(
    {
      type: 'event.updated',
      payload: { eventId: current.id },
      createdAt: nowIso(),
    },
    current.userId,
  )

  return updatedAttendee
}

export async function removeAttendee(
  eventId: string,
  attendeeId: string,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const current = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!current) {
    return false
  }

  const nextAttendees = current.attendees.filter((attendee) => attendee.id !== attendeeId)

  if (nextAttendees.length === current.attendees.length) {
    return false
  }

  await dependencies.eventsRepository.saveEvent({
    ...current,
    attendees: nextAttendees,
    updatedAt: nowIso(),
  })

  await dependencies.realtimeRepository.push(
    {
      type: 'event.updated',
      payload: { eventId: current.id },
      createdAt: nowIso(),
    },
    current.userId,
  )

  return true
}

export async function batchDeleteEvents(
  eventIds: string[],
  dependencies: EventDependencies,
  userId?: string | null,
) {
  let deletedCount = 0

  for (const eventId of eventIds) {
    if (await deleteEvent(eventId, {}, dependencies, userId)) {
      deletedCount += 1
    }
  }

  return deletedCount
}

export async function sendAttendeeInvitations(
  eventId: string,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const event = await dependencies.eventsRepository.findEvent(eventId, userId)

  if (!event) {
    return null
  }

  const owner = userId ? await dependencies.usersRepository.findUserById(userId) : null
  let sentCount = 0
  let skippedCount = 0

  for (const attendee of event.attendees) {
    if (!attendee.email) {
      skippedCount += 1
      continue
    }

    const invitedUser = await dependencies.usersRepository.findUserByEmail(attendee.email)

    if (!invitedUser) {
      skippedCount += 1
      continue
    }

    const notification = await dependencies.notificationsRepository.create(
      {
        id: `ntf_${crypto.randomUUID()}`,
        title: `${owner?.name ?? 'Vocalendar'} 邀请您参加活动`,
        message: `${event.title} 将于 ${event.startTime} 开始`,
        time: event.startTime,
        read: false,
      },
      invitedUser.user.id,
    )

    await dependencies.realtimeRepository.push(
      {
        type: 'notification.new',
        payload: { notificationId: notification.id },
        createdAt: nowIso(),
      },
      invitedUser.user.id,
    )
    sentCount += 1
  }

  return {
    sentCount,
    skippedCount,
  }
}

async function applyRecurringEventUpdate(
  current: EventRecord,
  event: UpdateEventRequest,
  dependencies: EventDependencies,
) {
  if (!current.recurrence || !event.recurrenceScope || event.recurrenceScope === 'all') {
    const updated: EventRecord = {
      ...current,
      ...event,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    }

    return await dependencies.eventsRepository.saveEvent(updated)
  }

  const occurrenceStartTime = event.occurrenceStartTime as string

  if (event.recurrenceScope === 'single') {
    const recurringBase = await dependencies.eventsRepository.saveEvent({
      ...current,
      recurrence: addRecurrenceExclusion(current.recurrence, occurrenceStartTime),
      updatedAt: nowIso(),
    })

    void recurringBase

    return await dependencies.eventsRepository.saveEvent({
      ...current,
      ...stripRecurrenceMutationFields(event),
      id: `evt_${crypto.randomUUID()}`,
      startTime: event.startTime,
      endTime: event.endTime,
      recurrence: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
  }

  const currentOccurrenceIndex = getRawOccurrenceIndex(current, occurrenceStartTime)
  const currentTotalCount = current.recurrence.count

  if (currentTotalCount == null) {
    throw new Error('Recurring following updates require bounded recurrence count.')
  }

  const precedingCount = currentOccurrenceIndex
  const followingCount = currentTotalCount - precedingCount
  const baseUpdatedAt = nowIso()

  if (precedingCount <= 0) {
    await dependencies.eventsRepository.deleteEvent(current.id, current.userId)

    return await dependencies.eventsRepository.saveEvent({
      ...current,
      ...stripRecurrenceMutationFields(event),
      id: `evt_${crypto.randomUUID()}`,
      startTime: event.startTime,
      endTime: event.endTime,
      recurrence: event.recurrence
        ? {
            ...event.recurrence,
            count: followingCount,
            until: null,
            exclusions: [],
          }
        : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
  }

  await dependencies.eventsRepository.saveEvent({
    ...current,
    recurrence: {
      ...current.recurrence,
      count: precedingCount,
      until: null,
    },
    updatedAt: baseUpdatedAt,
  })

  return await dependencies.eventsRepository.saveEvent({
    ...current,
    ...stripRecurrenceMutationFields(event),
    id: `evt_${crypto.randomUUID()}`,
    startTime: event.startTime,
    endTime: event.endTime,
    recurrence: event.recurrence
      ? {
          ...event.recurrence,
          count: followingCount,
          until: null,
          exclusions: [],
        }
      : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })
}

async function applyRecurringEventDelete(
  current: EventRecord,
  query: DeleteEventQuery,
  dependencies: EventDependencies,
  userId?: string | null,
) {
  const scope = query.recurrenceScope

  if (!current.recurrence || !scope || scope === 'all') {
    return {
      ok: await dependencies.eventsRepository.deleteEvent(current.id, userId),
      realtimeType: 'event.deleted' as const,
      eventId: current.id,
    }
  }

  const occurrenceStartTime = query.occurrenceStartTime as string

  if (scope === 'single') {
    await dependencies.eventsRepository.saveEvent({
      ...current,
      recurrence: addRecurrenceExclusion(current.recurrence, occurrenceStartTime),
      updatedAt: nowIso(),
    })

    return {
      ok: true,
      realtimeType: 'event.updated' as const,
      eventId: current.id,
    }
  }

  const currentOccurrenceIndex = getRawOccurrenceIndex(current, occurrenceStartTime)
  const currentTotalCount = current.recurrence.count

  if (currentTotalCount == null) {
    throw new Error('Recurring following deletes require bounded recurrence count.')
  }

  const precedingCount = currentOccurrenceIndex

  if (precedingCount <= 0) {
    return {
      ok: await dependencies.eventsRepository.deleteEvent(current.id, userId),
      realtimeType: 'event.deleted' as const,
      eventId: current.id,
    }
  }

  await dependencies.eventsRepository.saveEvent({
    ...current,
    recurrence: {
      ...current.recurrence,
      count: precedingCount,
      until: null,
    },
    updatedAt: nowIso(),
  })

  return {
    ok: true,
    realtimeType: 'event.updated' as const,
    eventId: current.id,
  }
}

function stripRecurrenceMutationFields(event: UpdateEventRequest) {
  const {
    recurrenceScope: _recurrenceScope,
    occurrenceStartTime: _occurrenceStartTime,
    ...rest
  } = event

  return rest
}

function addRecurrenceExclusion(
  recurrence: NonNullable<EventRecord['recurrence']>,
  occurrenceStartTime: string,
) {
  const nextExclusions = new Set(recurrence.exclusions ?? [])
  nextExclusions.add(occurrenceStartTime)

  return {
    ...recurrence,
    exclusions: [...nextExclusions].sort(),
  }
}

function getRawOccurrenceIndex(event: EventRecord, occurrenceStartTime: string) {
  if (!event.recurrence) {
    return 0
  }

  const startTimes = generateRawOccurrenceStartTimes(event.startTime, event.recurrence)
  const index = startTimes.indexOf(occurrenceStartTime)

  if (index === -1) {
    throw new Error(`Occurrence ${occurrenceStartTime} does not belong to the recurring series.`)
  }

  return index
}

function generateRawOccurrenceStartTimes(
  seedStartTime: string,
  recurrence: NonNullable<EventRecord['recurrence']>,
) {
  const generationLimit = resolveOccurrenceGenerationLimit(recurrence)

  if (recurrence.frequency === 'weekly' && recurrence.byWeekDay.length > 0) {
    return generateWeeklyOccurrences(seedStartTime, recurrence, generationLimit)
  }

  const startTimes: string[] = []
  const currentStart = new Date(seedStartTime)

  for (let index = 0; index < generationLimit; index += 1) {
    startTimes.push(currentStart.toISOString())
    advanceOccurrence(currentStart, recurrence)

    if (recurrence.until && currentStart.toISOString() > recurrence.until) {
      break
    }
  }

  return startTimes
}

function advanceOccurrence(date: Date, recurrence: NonNullable<EventRecord['recurrence']>) {
  const interval = recurrence.interval ?? 1

  switch (recurrence.frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + interval)
      return
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7 * interval)
      return
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + interval)
      return
    case 'yearly':
      date.setUTCFullYear(date.getUTCFullYear() + interval)
      return
  }
}

function generateWeeklyOccurrences(
  seedStartTime: string,
  recurrence: NonNullable<EventRecord['recurrence']>,
  generationLimit: number,
) {
  const seedDate = new Date(seedStartTime)
  const weekDays = [...recurrence.byWeekDay].sort((left, right) => left - right)
  const results: string[] = []
  let weekOffset = 0

  while (results.length < generationLimit) {
    for (const weekDay of weekDays) {
      const occurrence = shiftToWeekDay(seedDate, weekDay, weekOffset * (recurrence.interval ?? 1))

      if (occurrence < seedDate) {
        continue
      }

      if (recurrence.until && occurrence.toISOString() > recurrence.until) {
        return results
      }

      results.push(occurrence.toISOString())

      if (results.length === generationLimit) {
        break
      }
    }

    weekOffset += 1
  }

  return results
}

function shiftToWeekDay(seedDate: Date, weekDay: number, weekOffset: number) {
  const shifted = new Date(seedDate)
  const deltaDays = weekDay - shifted.getUTCDay() + weekOffset * 7

  shifted.setUTCDate(shifted.getUTCDate() + deltaDays)

  return shifted
}

function resolveOccurrenceGenerationLimit(recurrence: NonNullable<EventRecord['recurrence']>) {
  if (recurrence.count != null) {
    return recurrence.count
  }

  if (recurrence.until) {
    return 512
  }

  return 256
}
