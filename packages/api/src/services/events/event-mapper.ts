import type { EventRecord, V1EventDraftRecord as EventDraft } from '@vocalendar/schemas'

import { nowIso } from '../../utils/clock.js'

export function draftToEventRecord(draft: EventDraft): EventRecord {
  const timestamp = nowIso()

  return {
    id: `evt_${crypto.randomUUID()}`,
    userId: draft.userId ?? 'usr_dev',
    title: draft.parsed.title as string,
    description: null,
    startTime: draft.parsed.startAt as string,
    endTime: draft.parsed.endAt,
    allDay: false,
    timezone: draft.parsed.timezone,
    location: draft.parsed.location,
    recurrence: null,
    reminders: [],
    attendees: [],
    priority: 'normal',
    tags: [],
    source: draft.source === 'voice' ? 'voice' : 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
