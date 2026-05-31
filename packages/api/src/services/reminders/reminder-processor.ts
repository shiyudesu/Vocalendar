import type { EventRecord } from '@vocalendar/schemas'

import type {
  EventsRepository,
  NotificationsRepository,
  RealtimeRepository,
} from '../../repositories/events.types.js'

type ReminderProcessorDependencies = {
  eventsRepository: EventsRepository
  notificationsRepository: NotificationsRepository
  realtimeRepository: RealtimeRepository
}

type ProcessDueRemindersInput = {
  now?: string
}

export async function processDueReminders(
  input: ProcessDueRemindersInput,
  dependencies: ReminderProcessorDependencies,
) {
  const now = input.now ?? new Date().toISOString()
  const candidates = await dependencies.eventsRepository.listReminderCandidateEvents()
  let processedCount = 0

  for (const candidate of candidates) {
    const nextEvent = await processEventReminders(candidate, now, dependencies)

    if (!nextEvent.changed) {
      continue
    }

    await dependencies.eventsRepository.saveEvent(nextEvent.event)
    processedCount += nextEvent.processedCount
  }

  return {
    processedCount,
  }
}

async function processEventReminders(
  event: EventRecord,
  now: string,
  dependencies: ReminderProcessorDependencies,
) {
  let changed = false
  let processedCount = 0
  const nextReminders: EventRecord['reminders'] = []

  for (const reminder of event.reminders) {
    const dueOccurrences = resolveDueOccurrences(event, reminder, now)

    if (dueOccurrences.length === 0) {
      nextReminders.push(reminder)
      continue
    }

    for (const dueOccurrence of dueOccurrences) {
      const notification = await dependencies.notificationsRepository.create(
        {
          id: `ntf_${crypto.randomUUID()}`,
          title: `${event.title} 提醒`,
          message: `${event.title} 将在 ${reminder.minutesBefore} 分钟后开始`,
          time: dueOccurrence.triggerTime,
          read: false,
        },
        event.userId,
      )

      await dependencies.realtimeRepository.push(
        {
          type: 'notification.new',
          payload: { notificationId: notification.id },
          createdAt: now,
        },
        event.userId,
      )
    }

    nextReminders.push({
      ...reminder,
      sentAt: dueOccurrences.at(-1)?.triggerTime ?? reminder.sentAt,
    })
    changed = true
    processedCount += dueOccurrences.length
  }

  if (!changed) {
    return {
      changed: false,
      processedCount: 0,
      event,
    }
  }

  return {
    changed: true,
    processedCount,
    event: {
      ...event,
      reminders: nextReminders,
      updatedAt: now,
    },
  }
}

function resolveDueOccurrences(
  event: EventRecord,
  reminder: EventRecord['reminders'][number],
  now: string,
) {
  const nowMs = Date.parse(now)
  const previousSentMs = reminder.sentAt ? Date.parse(reminder.sentAt) : Number.NEGATIVE_INFINITY
  const occurrenceStartTimes = generateOccurrenceStartTimes(event)
  const results: Array<{
    occurrenceStartTime: string
    triggerTime: string
  }> = []

  for (const occurrenceStartTime of occurrenceStartTimes) {
    const triggerMs = Date.parse(occurrenceStartTime) - reminder.minutesBefore * 60_000

    if (triggerMs > nowMs) {
      continue
    }

    if (triggerMs <= previousSentMs) {
      continue
    }

    results.push({
      occurrenceStartTime,
      triggerTime: new Date(triggerMs).toISOString(),
    })
  }

  return results
}

function generateOccurrenceStartTimes(event: EventRecord) {
  if (!event.recurrence) {
    return [event.startTime]
  }

  const generationLimit = resolveOccurrenceGenerationLimit(event.recurrence)

  if (event.recurrence.frequency === 'weekly' && event.recurrence.byWeekDay.length > 0) {
    return generateWeeklyOccurrences(event.startTime, event.recurrence, generationLimit).filter(
      (item) => !event.recurrence?.exclusions.includes(item),
    )
  }

  const startTimes: string[] = []
  const currentStart = new Date(event.startTime)

  for (let index = 0; index < generationLimit; index += 1) {
    const nextStartTime = currentStart.toISOString()

    if (!event.recurrence.exclusions.includes(nextStartTime)) {
      startTimes.push(nextStartTime)
    }

    advanceOccurrence(currentStart, event.recurrence)

    if (event.recurrence.until && currentStart.toISOString() > event.recurrence.until) {
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

  return 4096
}
