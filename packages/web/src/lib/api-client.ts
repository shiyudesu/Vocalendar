import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiTransport,
  AuthSessionResponse,
  CreateDraftRequest,
  EventRecord,
  ListEventsInput,
  ListEventsResponse,
  LoginInput,
  NotificationRecord,
  RealtimeEnvelope,
  RegisterInput,
  UpdateDraftRequest,
  UpdateEventRequest,
  UpdateUserSettingsRequest,
  UserProfile,
  V1EventDraftRecord,
} from './api-types'

type SessionTokens = {
  accessToken: string
  refreshToken: string
}

interface ApiClientOptions {
  baseUrl?: string
  transport?: ApiTransport
  getSessionTokens?: () => SessionTokens | null
  onSessionTokens?: (tokens: SessionTokens) => void
  onUnauthorized?: () => void
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

const defaultApiBaseUrl = 'http://localhost:8061'

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/u, '')
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly websocketImpl?: typeof WebSocket
  private readonly getSessionTokens?: () => SessionTokens | null
  private readonly onSessionTokens?: (tokens: SessionTokens) => void
  private readonly onUnauthorized?: () => void

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getApiBaseUrl()).replace(/\/$/u, '')
    this.fetchImpl = options.transport
      ? options.transport.fetch.bind(options.transport)
      : globalThis.fetch.bind(globalThis)
    this.websocketImpl = options.transport?.websocket
    this.getSessionTokens = options.getSessionTokens
    this.onSessionTokens = options.onSessionTokens
    this.onUnauthorized = options.onUnauthorized
  }

  async register(input: RegisterInput) {
    return await this.request<AuthSessionResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
      auth: false,
    })
  }

  async login(input: LoginInput) {
    return await this.request<AuthSessionResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
      auth: false,
    })
  }

  async refresh(refreshToken: string) {
    return await this.request<AuthSessionResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      headers: {
        'content-type': 'application/json',
      },
      auth: false,
    })
  }

  async logout() {
    return await this.request<{ success: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
    })
  }

  async getMe() {
    const payload = await this.request<{ user: UserProfile }>('/api/v1/me')
    return payload.user
  }

  async updateSettings(input: UpdateUserSettingsRequest) {
    const payload = await this.request<{ user: UserProfile }>('/api/v1/me/settings', {
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
    })
    return payload.user
  }

  async listEvents(input: ListEventsInput) {
    const searchParams = new URLSearchParams()

    if (input.startDate) searchParams.set('startDate', input.startDate)
    if (input.endDate) searchParams.set('endDate', input.endDate)
    if (input.timezone) searchParams.set('timezone', input.timezone)
    if (input.keyword) searchParams.set('keyword', input.keyword)
    if (input.source) searchParams.set('source', input.source)
    if (input.priority) searchParams.set('priority', input.priority)
    if (input.cursor) searchParams.set('cursor', input.cursor)
    if (input.limit) searchParams.set('limit', String(input.limit))

    return await this.request<ListEventsResponse>(`/api/v1/events?${searchParams.toString()}`)
  }

  async getEvent(eventId: string) {
    const payload = await this.request<{ event: EventRecord }>(`/api/v1/events/${eventId}`)
    return payload.event
  }

  async updateEvent(eventId: string, input: UpdateEventRequest) {
    const payload = await this.request<{ event: EventRecord }>(`/api/v1/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
    })
    return payload.event
  }

  async deleteEvent(eventId: string) {
    return await this.request<{ success: boolean }>(`/api/v1/events/${eventId}`, {
      method: 'DELETE',
    })
  }

  async createDraft(input: CreateDraftRequest) {
    const payload = await this.request<{ draft: V1EventDraftRecord }>('/api/v1/drafts', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
    })
    return payload.draft
  }

  async updateDraft(draftId: string, input: UpdateDraftRequest) {
    const payload = await this.request<{ draft: V1EventDraftRecord }>(`/api/v1/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
      headers: {
        'content-type': 'application/json',
      },
    })
    return payload.draft
  }

  async confirmDraft(draftId: string) {
    const payload = await this.request<{ event: EventRecord }>(
      `/api/v1/drafts/${draftId}/confirm`,
      {
        method: 'POST',
      },
    )
    return payload.event
  }

  async listNotifications() {
    const payload = await this.request<{ items: NotificationRecord[] }>('/api/v1/notifications')
    return payload.items
  }

  async markNotificationRead(notificationId: string, read: boolean) {
    const payload = await this.request<{ notification: NotificationRecord }>(
      `/api/v1/notifications/${notificationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ read }),
        headers: {
          'content-type': 'application/json',
        },
      },
    )
    return payload.notification
  }

  connectRealtime(onMessage: (message: RealtimeEnvelope) => void) {
    const websocketImpl = this.websocketImpl ?? WebSocket
    const tokens = this.getSessionTokens?.()

    if (!tokens?.accessToken) {
      throw new Error('Cannot connect realtime without an access token.')
    }

    const socket = new websocketImpl(
      `${this.baseUrl.replace(/^http/u, 'ws')}/api/v1/realtime/ws?accessToken=${encodeURIComponent(tokens.accessToken)}`,
    )

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data)) as RealtimeEnvelope
      onMessage(payload)
    })

    return socket
  }

  private async request<TData>(
    path: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: BodyInit | null
      auth?: boolean
      retryOnUnauthorized?: boolean
    } = {},
  ): Promise<TData> {
    const auth = options.auth ?? true
    const retryOnUnauthorized = options.retryOnUnauthorized ?? auth
    const headers = new Headers(options.headers)

    if (auth) {
      const tokens = this.getSessionTokens?.()

      if (!tokens?.accessToken) {
        this.onUnauthorized?.()
        throw new ApiClientError(401, {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing access token.',
            details: null,
          },
        })
      }

      headers.set('authorization', `Bearer ${tokens.accessToken}`)
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
    })

    const payload = (await response.json()) as ApiSuccessResponse<TData> | ApiErrorResponse

    if (response.status === 401 && auth && retryOnUnauthorized) {
      const refreshed = await this.tryRefreshSession()

      if (refreshed) {
        return await this.request<TData>(path, {
          ...options,
          retryOnUnauthorized: false,
        })
      }
    }

    if (!response.ok || 'error' in payload) {
      throw new ApiClientError(response.status, payload as ApiErrorResponse)
    }

    return payload.data
  }

  private async tryRefreshSession() {
    const tokens = this.getSessionTokens?.()

    if (!tokens?.refreshToken) {
      this.onUnauthorized?.()
      return false
    }

    try {
      const payload = await this.refresh(tokens.refreshToken)
      this.onSessionTokens?.({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      })
      return true
    } catch {
      this.onUnauthorized?.()
      return false
    }
  }
}
