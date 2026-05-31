import { describe, expect, test, vi } from 'vitest'

import { ApiClient } from './api-client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

describe('ApiClient', () => {
  test('preserves fetch invocation context for anonymous auth requests', async () => {
    type BoundFetchTransport = {
      fetch(
        this: BoundFetchTransport,
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response>
    }

    const transport: BoundFetchTransport = {
      fetch(this: BoundFetchTransport, input: RequestInfo | URL, init?: RequestInit) {
        if (this !== transport) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation")
        }

        expect(String(input)).toBe('http://localhost:8061/api/v1/auth/register')
        expect(init?.method).toBe('POST')

        return Promise.resolve(
          jsonResponse({
            data: {
              user: {
                id: 'usr_1',
                name: 'admin',
                email: 'admin@admin.com',
                settings: {
                  theme: 'system',
                  defaultView: 'week',
                  defaultReminderMinutes: 15,
                  voiceFeedback: true,
                  voiceSpeed: 1,
                  language: 'zh-CN',
                },
                createdAt: '2026-05-31T00:00:00.000Z',
                updatedAt: '2026-05-31T00:00:00.000Z',
              },
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            },
            meta: {
              requestId: 'req_register',
              timestamp: '2026-05-31T00:00:00.000Z',
            },
          }),
        )
      },
    }

    const client = new ApiClient({
      baseUrl: 'http://localhost:8061',
      transport,
    })

    const session = await client.register({
      name: 'admin',
      email: 'admin@admin.com',
      password: 'adminadmin',
    })

    expect(session.user.email).toBe('admin@admin.com')
    expect(session.accessToken).toBe('access-token')
  })

  test('retries once after refreshing an expired access token', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'expired',
              details: null,
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            user: {
              id: 'usr_1',
              name: '测试用户',
              email: 'user@example.com',
              settings: {
                theme: 'system',
                defaultView: 'week',
                defaultReminderMinutes: 15,
                voiceFeedback: true,
                voiceSpeed: 1,
                language: 'zh-CN',
              },
              createdAt: '2026-05-31T00:00:00.000Z',
              updatedAt: '2026-05-31T00:00:00.000Z',
            },
            accessToken: 'fresh-access',
            refreshToken: 'fresh-refresh',
          },
          meta: {
            requestId: 'req_refresh',
            timestamp: '2026-05-31T00:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            user: {
              id: 'usr_1',
              name: '测试用户',
              email: 'user@example.com',
              settings: {
                theme: 'system',
                defaultView: 'week',
                defaultReminderMinutes: 15,
                voiceFeedback: true,
                voiceSpeed: 1,
                language: 'zh-CN',
              },
              createdAt: '2026-05-31T00:00:00.000Z',
              updatedAt: '2026-05-31T00:00:00.000Z',
            },
          },
          meta: {
            requestId: 'req_me',
            timestamp: '2026-05-31T00:00:00.000Z',
          },
        }),
      )

    const tokens = {
      accessToken: 'expired-access',
      refreshToken: 'refresh-token',
    }
    const onSessionTokens = vi.fn((next) => {
      tokens.accessToken = next.accessToken
      tokens.refreshToken = next.refreshToken
    })

    const client = new ApiClient({
      baseUrl: 'http://localhost:8061',
      transport: { fetch: fetchImpl },
      getSessionTokens: () => tokens,
      onSessionTokens,
    })

    const user = await client.getMe()

    expect(user.id).toBe('usr_1')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(onSessionTokens).toHaveBeenCalledWith({
      accessToken: 'fresh-access',
      refreshToken: 'fresh-refresh',
    })
  })

  test('throws ApiClientError on unrecoverable API failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'DRAFT_MISSING_FIELDS',
            message: 'Draft is missing required fields.',
            details: {
              missingFields: ['startAt'],
            },
          },
        },
        422,
      ),
    )

    const client = new ApiClient({
      transport: { fetch: fetchImpl },
      getSessionTokens: () => ({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    })

    await expect(client.confirmDraft('drf_1')).rejects.toMatchObject({
      status: 422,
      code: 'DRAFT_MISSING_FIELDS',
    })
  })
})
