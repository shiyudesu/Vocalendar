import type {
  CreateDraftRequest,
  UpdateDraftRequest,
  V1EventDraftParsed as EventDraftParsed,
  V1EventDraftRecord as EventDraft,
} from '@vocalendar/schemas'

import type { EventsRepository } from '../../repositories/events.types.js'
import { parseDraftFields } from './draft-parser.js'

type DraftDependencies = {
  eventsRepository: EventsRepository
}

export async function createDraft(
  input: CreateDraftRequest,
  dependencies: DraftDependencies,
  options: { userId?: string | null } = {},
) {
  const parsedDraft = parseDraftFields({
    sourceText: input.sourceText,
    timezone: input.timezone,
    referenceAt: input.referenceAt,
  })
  const draft: EventDraft = {
    draftId: `drf_${crypto.randomUUID()}`,
    userId: options.userId ?? null,
    sourceText: input.sourceText,
    source: input.source,
    referenceAt: input.referenceAt,
    normalizedText: parsedDraft.normalizedText,
    parsed: parsedDraft.parsed,
    missingFields: parsedDraft.missingFields,
    warnings: parsedDraft.warnings,
    canSave: parsedDraft.missingFields.length === 0,
    clarificationPrompt: parsedDraft.clarificationPrompt,
  }

  return await dependencies.eventsRepository.saveDraft(draft)
}

export async function updateDraft(
  draftId: string,
  input: UpdateDraftRequest,
  dependencies: DraftDependencies,
  options: { userId?: string | null } = {},
) {
  const currentDraft = await dependencies.eventsRepository.findDraft(draftId, options.userId)

  if (!currentDraft) {
    return null
  }

  const timezone = input.fields?.timezone ?? currentDraft.parsed.timezone
  const parsedFromInput = input.userInput
    ? parseDraftFields({
        sourceText: `${currentDraft.sourceText} ${input.userInput}`,
        timezone,
        referenceAt: input.referenceAt as string,
      })
    : null
  const parsed = mergeParsedFields(
    currentDraft.parsed,
    parsedFromInput?.parsed ?? null,
    input.fields ?? null,
  )
  const missingFields = computeMissingFields(parsed)
  const draft: EventDraft = {
    ...currentDraft,
    referenceAt: input.referenceAt ?? currentDraft.referenceAt,
    normalizedText: parsedFromInput?.normalizedText ?? currentDraft.normalizedText,
    parsed,
    missingFields,
    warnings: parsedFromInput?.warnings ?? currentDraft.warnings,
    canSave: missingFields.length === 0,
    clarificationPrompt: buildClarificationPrompt(missingFields),
  }

  return await dependencies.eventsRepository.saveDraft(draft)
}

function mergeParsedFields(
  current: EventDraftParsed,
  parsedFromInput: EventDraftParsed | null,
  directFields: Partial<EventDraftParsed> | null,
): EventDraftParsed {
  const parsed: EventDraftParsed = {
    ...current,
    participants: [...current.participants],
  }

  if (parsedFromInput) {
    parsed.title = parsedFromInput.title ?? parsed.title
    parsed.startAt = parsedFromInput.startAt ?? parsed.startAt
    parsed.endAt = parsedFromInput.endAt ?? parsed.endAt
    parsed.timezone = parsedFromInput.timezone
    parsed.location = parsedFromInput.location ?? parsed.location
    parsed.participants =
      parsedFromInput.participants.length > 0 ? parsedFromInput.participants : parsed.participants
  }

  if (directFields) {
    applyDirectField(parsed, directFields, 'title')
    applyDirectField(parsed, directFields, 'startAt')
    applyDirectField(parsed, directFields, 'endAt')
    applyDirectField(parsed, directFields, 'timezone')
    applyDirectField(parsed, directFields, 'location')
    applyDirectField(parsed, directFields, 'participants')
  }

  return parsed
}

function applyDirectField<TKey extends keyof EventDraftParsed>(
  parsed: EventDraftParsed,
  directFields: Partial<EventDraftParsed>,
  key: TKey,
) {
  if (Object.hasOwn(directFields, key)) {
    parsed[key] = directFields[key] as EventDraftParsed[TKey]
  }
}

function computeMissingFields(parsed: EventDraftParsed) {
  const missingFields: string[] = []

  if (!parsed.title) {
    missingFields.push('title')
  }

  if (!parsed.startAt) {
    missingFields.push('startAt')
  }

  if (!parsed.timezone) {
    missingFields.push('timezone')
  }

  return missingFields
}

function buildClarificationPrompt(missingFields: string[]) {
  if (missingFields.length === 0) {
    return null
  }

  if (missingFields.length === 1 && missingFields[0] === 'startAt') {
    return '请补充开始时间。'
  }

  if (missingFields.length === 1 && missingFields[0] === 'title') {
    return '请补充事件标题。'
  }

  return '请补充事件标题和开始时间。'
}
