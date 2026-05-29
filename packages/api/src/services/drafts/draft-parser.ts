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

type ParticipantMatch = {
  consumedSpan: Span
  values: string[]
}

type ParseDraftFieldsInput = {
  sourceText: string
  timezone: string
  referenceAt: string
}

type TimeExtraction = {
  startAt: string | null
  endAt: string | null
  consumedSpan: Span | null
}

type ExtractionResult = {
  value: string | null
  consumedSpan: Span | null
}

const punctuationBoundaryPattern = /[ ,，。；;：:]/u
const timeBoundaryPattern = /^(?:今天|明天|后天|今晚|今早|今晨|上午|中午|下午|晚上|凌晨|本周|下周|周[一二三四五六日天]?|星期[一二三四五六日天]?|礼拜[一二三四五六日天]?|\d+[点:\-]|\d+月|\d+号|[零〇一二两三四五六七八九十]+点)/u
const triggerBoundaryPattern = /^(?:在|到|去|于|和|跟|约|见|找|与|同)/u
const locationStopPhrases = [
  '喝咖啡',
  '喝茶',
  '开会',
  '吃饭',
  '出差',
  '讨论',
  '沟通',
  '复盘',
  '汇报',
  '演示',
  '培训',
  '看电影',
  '通话',
  '打电话',
  '见面',
  '约聊',
  '过方案',
  '一起',
]
const participantStopPhrases = [
  ...locationStopPhrases,
  '和',
  '跟',
  '与',
  '同',
]
const titleCleanupPatterns = [
  /(?:^|\s)(?:和|跟|约|见|找|在|到|去|于|与|同|一起)(?=\s|$)/gu,
  /\s+/gu,
]
const titleAffixTokens = ['和', '跟', '约', '见', '找', '在', '到', '去', '于', '与', '同', '一起']

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

  const timeResult = extractTime(normalizedText, input.referenceAt, input.timezone)
  if (timeResult.consumedSpan) {
    consumedSpans.push(timeResult.consumedSpan)
  }

  const locationResult = extractLocation(normalizedText, consumedSpans)
  if (locationResult.consumedSpan) {
    consumedSpans.push(locationResult.consumedSpan)
  }

  const participantMatches = extractParticipants(normalizedText, consumedSpans)
  consumedSpans.push(...participantMatches.map((match) => match.consumedSpan))

  const title = deriveTitle(normalizedText, consumedSpans)
  const participants = participantMatches.flatMap((match) => match.values)
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

function extractTime(text: string, referenceAt: string, timezone: string): TimeExtraction {
  const instant = new Date(referenceAt)
  const [result] = chrono.zh.parse(
    text,
    { instant, timezone: getTimezoneOffsetMinutes(instant, timezone) },
    { forwardDate: true },
  )

  if (!result) {
    return {
      startAt: null,
      endAt: null,
      consumedSpan: null as Span | null,
    }
  }

  const hasExplicitHour = result.start.isCertain('hour')

  return {
    startAt: hasExplicitHour ? result.start.date().toISOString() : null,
    endAt: result.end?.isCertain('hour') ? result.end.date().toISOString() : null,
    consumedSpan: {
      start: result.index,
      end: result.index + result.text.length,
    },
  }
}

function extractLocation(text: string, consumedSpans: Span[]): ExtractionResult {
  const locationPattern = /(?:在|到|去|于)/gu

  for (const match of text.matchAll(locationPattern)) {
    const triggerStart = match.index ?? 0
    const valueStart = triggerStart + match[0].length
    const consumedSpan = collectEntitySpan(text, valueStart, locationStopPhrases)
    if (!consumedSpan || overlaps(consumedSpan, consumedSpans)) {
      continue
    }

    const captured = text.slice(consumedSpan.start, consumedSpan.end)
    const value = cleanupEntity(captured)
    if (!value) {
      continue
    }

    return {
      value,
      consumedSpan,
    }
  }

  return {
    value: null,
    consumedSpan: null as Span | null,
  }
}

function extractParticipants(text: string, consumedSpans: Span[]): ParticipantMatch[] {
  const participantPattern = /(?:和|跟|约|见|找)/gu
  const participants: ParticipantMatch[] = []

  for (const match of text.matchAll(participantPattern)) {
    const triggerStart = match.index ?? 0
    const valueStart = triggerStart + match[0].length
    const consumedSpan = collectEntitySpan(text, valueStart, participantStopPhrases)
    if (!consumedSpan || overlaps(consumedSpan, consumedSpans)) {
      continue
    }

    const triggeredText = text.slice(triggerStart, consumedSpan.end)
    if (standaloneSignalPattern.test(triggeredText)) {
      continue
    }

    const values = splitParticipants(text.slice(consumedSpan.start, consumedSpan.end))
    if (values.length === 0) {
      continue
    }

    participants.push({ consumedSpan, values })
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
  let cleaned = residual
  for (const pattern of titleCleanupPatterns) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  cleaned = stripOptionalTitleAffixes(cleaned.trim())

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
  return value.replace(/[ ,，。；;：:]+$/gu, '').trim() || null
}

function splitParticipants(value: string) {
  return value
    .split(/[和跟与同]/u)
    .map((part) => cleanupEntity(part))
    .filter((part): part is string => part !== null)
}

function collectEntitySpan(text: string, valueStart: number, stopPhrases: string[]) {
  let start = valueStart
  while (start < text.length && text[start] === ' ') {
    start += 1
  }

  if (start >= text.length) {
    return null
  }

  let end = start
  while (end < text.length) {
    const slice = text.slice(end)
    if (punctuationBoundaryPattern.test(text[end])) {
      break
    }

    if (end > start && triggerBoundaryPattern.test(slice)) {
      break
    }

    if (end > start && timeBoundaryPattern.test(slice)) {
      break
    }

    if (stopPhrases.some((phrase) => slice.startsWith(phrase))) {
      break
    }

    end += 1
  }

  return end > start ? { start, end } : null
}

function getTimezoneOffsetMinutes(instant: Date, timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(instant)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const zonedTimestamp = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )

    return Math.round((zonedTimestamp - instant.getTime()) / 60000)
  } catch {
    return 0
  }
}

function stripOptionalTitleAffixes(value: string) {
  let cleaned = value

  for (;;) {
    let next = cleaned

    for (const token of titleAffixTokens) {
      if (next.startsWith(token)) {
        const candidate = next.slice(token.length).trim()
        if (isBetterTitleCandidate(candidate)) {
          next = candidate
          break
        }
      }
    }

    for (const token of titleAffixTokens) {
      if (next.endsWith(token)) {
        const candidate = next.slice(0, -token.length).trim()
        if (isBetterTitleCandidate(candidate)) {
          next = candidate
          break
        }
      }
    }

    if (next === cleaned) {
      return cleaned
    }

    cleaned = next
  }
}

function isBetterTitleCandidate(value: string) {
  return value.length > 0 && standaloneSignalPattern.test(value)
}
