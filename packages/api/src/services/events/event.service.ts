import type { Event } from '@vocalendar/schemas'

import { eventMemoryRepository } from '../../repositories/events.memory.js'
import { nowIso } from '../../utils/clock.js'

export type CreateEventFromDraftResult =
  | {
      ok: true
      event: Event
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

export function createEventFromDraft(draftId: string): CreateEventFromDraftResult {
  const draft = eventMemoryRepository.findDraft(draftId)

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

  return {
    ok: true,
    event: eventMemoryRepository.saveEvent(event),
  }
}

export function listRecentEvents(limit: number, offset: number) {
  return eventMemoryRepository.listRecentEvents(
    Math.min(Math.max(limit, 1), 100),
    Math.max(offset, 0),
  )
}

export function countEvents() {
  return eventMemoryRepository.countEvents()
}
