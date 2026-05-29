import * as chrono from 'chrono-node'

const chineseDigitMap: Record<string, string> = {
  '〇': '0',
  '零': '0',
  '一': '1',
  '二': '2',
  '两': '2',
  '三': '3',
  '四': '4',
  '五': '5',
  '六': '6',
  '七': '7',
  '八': '8',
  '九': '9',
}

const standaloneSignalPattern =
  /(会议|开会|喝咖啡|咖啡|聚餐|吃饭|面试|讨论|沟通|拜访|见面|约聊|通话|电话|复盘|汇报|演示|培训|看电影|出发|会)/u

const noisePattern = /^[啊呀哦嗯呃欸哈啦吧呢嘛]+$/u

type Span = {
  start: number
  end: number
}

type ParticipantMatch = Span & {
  value: string
}

type ParseDraftFieldsInput = {
  sourceText: string
  timezone: string
  referenceAt: string
}

export class DraftParseError extends Error {
  code = 'DRAFT_PARSE_FAILED' as const

  constructor(message = 'Source text cannot be parsed into a valid draft.') {
    super(message)
    this.name = 'DraftParseError'
  }
}

export type ParsedDraftFields = {
  normalizedText: string
  parsed: {
    title: string | null
    startAt: string | null
    endAt: string | null
    timezone: string
    location: string | null
    participants: string[]
  }
  missingFields: string[]
  warnings: string[]
  clarificationPrompt: string | null
}

export function parseDraftFields(input: ParseDraftFieldsInput): ParsedDraftFields {
  const normalizedText = normalizeText(input.sourceText)
  const warnings: string[] = []
  const consumedSpans: Span[] = []

  const timeResult = extractTime(normalizedText, input.referenceAt)
  if (timeResult.consumedSpan) {
    consumedSpans.push(timeResult.consumedSpan)
  }

  const locationResult = extractLocation(normalizedText, consumedSpans)
  if (locationResult.consumedSpan) {
    consumedSpans.push(locationResult.consumedSpan)
  }

  const participantMatches = extractParticipants(normalizedText, consumedSpans)
  consumedSpans.push(...participantMatches.map(({ start, end }) => ({ start, end })))

  const title = deriveTitle(normalizedText, consumedSpans)
  const participants = participantMatches.map((match) => match.value)
  const missingFields = computeMissingFields(title, timeResult.startAt)
  const clarificationPrompt = buildClarificationPrompt(missingFields)

  if (!hasUsableSignal(normalizedText, title, timeResult.startAt, locationResult.value, participants)) {
    throw new DraftParseError()
  }

  return {
    normalizedText,
    parsed: {
      title,
      startAt: timeResult.startAt,
      endAt: timeResult.endAt,
      timezone: input.timezone,
      location: locationResult.value,
      participants,
    },
    missingFields,
    warnings,
    clarificationPrompt,
  }
}

function normalizeText(sourceText: string): string {
  return sourceText
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[：]/gu, ':')
    .replace(/[，、]/gu, ' ')
    .replace(/([零〇一二两三四五六七八九])点/gu, (_, digit: string) => `${chineseDigitMap[digit] ?? digit}点`)
}

function extractTime(text: string, referenceAt: string) {
  const referenceDate = new Date(referenceAt)
  const [result] = chrono.zh.parse(text, referenceDate, { forwardDate: true })

  if (!result) {
    return {
      startAt: null,
      endAt: null,
      consumedSpan: null as Span | null,
    }
  }

  const hasExplicitHour = result.start.isCertain('hour')
  const hasDateSignal = result.start.isCertain('day') || result.start.isCertain('weekday')

  return {
    startAt: hasExplicitHour ? result.start.date().toISOString() : null,
    endAt: result.end?.isCertain('hour') ? result.end.date().toISOString() : null,
    consumedSpan: hasDateSignal
      ? {
          start: result.index,
          end: result.index + result.text.length,
        }
      : null,
  }
}

function extractLocation(text: string, consumedSpans: Span[]) {
  const locationPattern = /(?:在|到|去|于)([^和跟约见找叫把给跟与同,，。；;：:\s]{1,20})/gu

  for (const match of text.matchAll(locationPattern)) {
    const captured = match[1]?.trim()
    const start = (match.index ?? 0) + match[0].indexOf(captured)
    const end = start + captured.length
    if (!captured || overlaps({ start, end }, consumedSpans)) {
      continue
    }

    return {
      value: cleanupEntity(captured),
      consumedSpan: { start, end },
    }
  }

  return {
    value: null,
    consumedSpan: null as Span | null,
  }
}

function extractParticipants(text: string, consumedSpans: Span[]): ParticipantMatch[] {
  const participantPattern = /(?:和|跟|约|见|找)([^在到去于,，。；;：:\s]{1,20})/gu
  const participants: ParticipantMatch[] = []

  for (const match of text.matchAll(participantPattern)) {
    const captured = match[1]?.trim()
    const start = (match.index ?? 0) + match[0].indexOf(captured)
    const end = start + captured.length
    if (!captured || overlaps({ start, end }, consumedSpans)) {
      continue
    }

    const value = cleanupEntity(captured)
    if (!value) {
      continue
    }

    participants.push({ start, end, value })
  }

  return participants
}

function deriveTitle(text: string, consumedSpans: Span[]): string | null {
  const characters = [...text]

  for (const span of consumedSpans) {
    for (let index = span.start; index < span.end; index += 1) {
      if (index >= 0 && index < characters.length) {
        characters[index] = ' '
      }
    }
  }

  const residual = characters.join('')
  const cleaned = residual
    .replace(/[和跟约见找在到去于同与]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

  return cleaned.length > 0 ? cleaned : null
}

function computeMissingFields(title: string | null, startAt: string | null) {
  const missingFields: string[] = []

  if (!title) {
    missingFields.push('title')
  }

  if (!startAt) {
    missingFields.push('startAt')
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

function hasUsableSignal(
  normalizedText: string,
  title: string | null,
  startAt: string | null,
  location: string | null,
  participants: string[],
) {
  if (startAt || location || participants.length > 0) {
    return true
  }

  if (!title) {
    return false
  }

  if (noisePattern.test(normalizedText)) {
    return false
  }

  return standaloneSignalPattern.test(title)
}

function overlaps(span: Span, consumedSpans: Span[]) {
  return consumedSpans.some((consumedSpan) => span.start < consumedSpan.end && span.end > consumedSpan.start)
}

function cleanupEntity(value: string) {
  return value.replace(/[和跟约见找在到去于,，。；;：:]+$/gu, '').trim() || null
}
