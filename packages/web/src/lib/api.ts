const defaultApiBaseUrl = 'http://localhost:8061'

export type EventDraft = {
  draftId: string
  sourceText: string
  source: 'text' | 'voice'
  referenceAt: string
  normalizedText?: string
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
  canSave: boolean
  clarificationPrompt: string | null
}

type ApiSuccessResponse<TData> = {
  data: TData
  meta: {
    requestId: string
    timestamp: string
  }
}

type ApiErrorResponse = {
  error: {
    code: string
    message: string
    details: unknown
  }
  meta?: {
    requestId: string
    timestamp: string
  }
}

export type CreateDraftInput = {
  sourceText: string
  timezone: string
  referenceAt: string
}

export class ApiClientError extends Error {
  readonly code: string
  readonly details: unknown
  readonly status: number

  constructor(status: number, payload: ApiErrorResponse) {
    super(payload.error.message)
    this.name = 'ApiClientError'
    this.code = payload.error.code
    this.details = payload.error.details
    this.status = status
  }
}

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/u, '')
}

export async function createDraft(input: CreateDraftInput) {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/drafts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      source: 'text',
    }),
  })
  const payload = (await response.json()) as
    | ApiSuccessResponse<{ draft: EventDraft }>
    | ApiErrorResponse

  if (!response.ok || 'error' in payload) {
    throw new ApiClientError(response.status, payload as ApiErrorResponse)
  }

  return payload.data.draft
}
