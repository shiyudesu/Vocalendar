import type {
  CreateDraftRequest,
  EventRecord,
  NotificationRecord,
  UpdateDraftRequest,
  UpdateEventRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  V1EventDraftRecord,
} from '@vocalendar/schemas'

export type ApiSuccessResponse<TData> = {
  data: TData
  meta: {
    requestId: string
    timestamp: string
  }
}

export type ApiErrorResponse = {
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

export interface AuthSessionResponse {
  user: UserProfile
  accessToken: string
  refreshToken: string
}

export interface RegisterInput {
  email: string
  password: string
  name: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface ListEventsInput {
  startDate?: string | null
  endDate?: string | null
  timezone?: string | null
  keyword?: string | null
  source?: EventRecord['source'] | null
  priority?: EventRecord['priority'] | null
  cursor?: string | null
  limit?: number
}

export interface ListEventsResponse {
  items: EventRecord[]
  page: {
    nextCursor: string | null
  }
}

export interface RealtimeEnvelope {
  type: string
  payload: unknown
  createdAt: string
}

export interface ApiTransport {
  fetch: typeof fetch
  websocket?: typeof WebSocket
}

export type {
  CreateDraftRequest,
  EventRecord,
  NotificationRecord,
  UpdateDraftRequest,
  UpdateEventRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  V1EventDraftRecord,
}
