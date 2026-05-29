import type { Event } from '@vocalendar/schemas'

import { eventMemoryRepository } from '../../repositories/events.memory.js'
import { nowIso } from '../../utils/clock.js'

export function createEventFromDraft(draftId: string): Event | null {
  const draft = eventMemoryRepository.findDraft(draftId)

  if (!draft || !draft.canSave || !draft.parsed.title || !draft.parsed.startAt) {
    return null
  }

  const timestamp = nowIso()
  const event: Event = {
    id: `evt_${crypto.randomUUID()}`,
    title: draft.parsed.title,
    description: null,
    startAt: draft.parsed.startAt,
    endAt: draft.parsed.endAt,
    timezone: draft.parsed.timezone,
    location: draft.parsed.location,
    participants: draft.parsed.participants,
    source: draft.source,
    status: 'confirmed',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return eventMemoryRepository.saveEvent(event)
}

export function listRecentEvents(limit: number) {
  return eventMemoryRepository.listRecentEvents(Math.min(Math.max(limit, 1), 10))
}
