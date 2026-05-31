import type { EventRecord, V1EventDraftRecord as EventDraft } from '@vocalendar/schemas'

import { nowIso } from '../../utils/clock.js'

type DraftToEventRecordOptions = {
  defaultReminderMinutes: number
}

export function draftToEventRecord(
  draft: EventDraft,
  options?: DraftToEventRecordOptions,
): EventRecord {
  const timestamp = nowIso()
  const eventId = `evt_${crypto.randomUUID()}`

  return {
    id: eventId,
    userId: draft.userId ?? 'usr_dev',
    title: draft.parsed.title as string,
    description: null,
    startTime: draft.parsed.startAt as string,
    endTime: draft.parsed.endAt,
    allDay: false,
    timezone: draft.parsed.timezone,
    location: draft.parsed.location,
    recurrence: null,
    reminders: [
      {
        id: `rem_${crypto.randomUUID()}`,
        eventId,
        minutesBefore: options?.defaultReminderMinutes ?? 15,
        method: 'push',
        sentAt: null,
      },
    ],
    attendees: [],
    priority: 'normal',
    tags: [],
    source: draft.source === 'voice' ? 'voice' : 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
