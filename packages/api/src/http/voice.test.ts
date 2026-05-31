import { describe, expect, test } from 'vitest'
import { WebSocket } from 'ws'

import { createRuntimeDependencies } from '../config/runtime.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { voiceHistoryMemoryRepository } from '../repositories/voice-history.memory.js'
import { createApp } from './app.js'
import { startTestServer } from './test-server.js'

describe('voice routes', () => {
  test('returns voice provider status, performs upload asr/tts via the runtime provider, and exposes voice history', async () => {
    userMemoryRepository.reset()
    voiceHistoryMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const seenUploads: Array<{
      provider: string
      language: string
      format: string
      byteLength: number
      enablePunctuation: boolean
    }> = []
    runtime.voice = {
      async listProviders() {
        return [
          {
            name: 'aliyun',
            available: true,
          },
        ]
      },
      async transcribeUpload(input) {
        seenUploads.push({
          provider: input.provider,
          language: input.language,
          format: input.format,
          byteLength: input.audio.byteLength,
          enablePunctuation: input.enablePunctuation,
        })

        return {
          provider: 'aliyun',
          language: input.language,
          text: '明天下午三点和张总在国贸喝咖啡',
          confidence: 0.96,
          segments: [{ startMs: 0, endMs: 1250, text: '明天下午三点' }],
        }
      },
      async synthesize(input) {
        expect(input.voice).toBe('zh-CN-Xiaoyun')

        return {
          provider: 'aliyun',
          mimeType: 'audio/mpeg',
          audio: Buffer.from('fake-mp3-audio'),
          durationMs: 2800,
        }
      },
      async startRealtimeSession() {
        throw new Error('unused in this test')
      },
    }
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)

    const providersResponse = await app.request('/api/v1/voice/providers')
    const providersPayload = (await providersResponse.json()) as {
      data: {
        providers: Array<{
          name: string
          available: boolean
        }>
      }
    }

    expect(providersResponse.status).toBe(200)
    expect(providersPayload.data.providers.some((provider) => provider.name === 'aliyun')).toBe(
      true,
    )

    const asrForm = new FormData()
    asrForm.set('audio', new File([Buffer.alloc(3200, 1)], 'sample.wav', { type: 'audio/wav' }))
    asrForm.set('language', 'zh-CN')
    asrForm.set('provider', 'aliyun')
    asrForm.set('enablePunctuation', 'true')

    const asrResponse = await app.request('/api/v1/voice/asr', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: asrForm,
    })
    const asrPayload = (await asrResponse.json()) as {
      data: {
        text: string
        language: string
        confidence: number
        segments: Array<{
          startMs: number
          endMs: number
          text: string
        }>
      }
    }

    expect(asrResponse.status).toBe(200)
    expect(asrPayload.data.text).toBe('明天下午三点和张总在国贸喝咖啡')
    expect(asrPayload.data.language).toBe('zh-CN')
    expect(asrPayload.data.segments).toEqual([{ startMs: 0, endMs: 1250, text: '明天下午三点' }])
    expect(seenUploads).toEqual([
      {
        provider: 'aliyun',
        language: 'zh-CN',
        format: 'wav',
        byteLength: 3200,
        enablePunctuation: true,
      },
    ])

    const ttsResponse = await app.request('/api/v1/voice/tts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: '已为您创建明天下午三点的客户会议',
        language: 'zh-CN',
        voice: 'zh-CN-Xiaoyun',
        speed: 1,
      }),
    })
    const ttsPayload = (await ttsResponse.json()) as {
      data: {
        audioUrl: string
        mimeType: string
        durationMs: number
      }
    }

    expect(ttsResponse.status).toBe(200)
    expect(ttsPayload.data.audioUrl).toBe(
      `data:audio/mpeg;base64,${Buffer.from('fake-mp3-audio').toString('base64')}`,
    )
    expect(ttsPayload.data.mimeType).toBe('audio/mpeg')
    expect(ttsPayload.data.durationMs).toBe(2800)

    const historyResponse = await app.request('/api/v1/voice-history', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    const historyPayload = (await historyResponse.json()) as {
      data: {
        items: Array<{
          kind: string
          provider: string
          language?: string
          requestSummary: Record<string, unknown>
          resultSummary: Record<string, unknown>
        }>
      }
    }

    expect(historyResponse.status).toBe(200)
    expect(historyPayload.data.items.map((item) => item.kind)).toEqual(['tts', 'asr'])
    expect(historyPayload.data.items.every((item) => item.provider === 'aliyun')).toBe(true)
    expect(historyPayload.data.items.every((item) => item.language === 'zh-CN')).toBe(true)
    expect(historyPayload.data.items[0]?.resultSummary).toEqual({
      durationMs: 2800,
      mimeType: 'audio/mpeg',
    })
    expect(historyPayload.data.items[1]?.resultSummary).toEqual({
      text: '明天下午三点和张总在国贸喝咖啡',
      confidence: 0.96,
      segments: [{ startMs: 0, endMs: 1250, text: '明天下午三点' }],
    })

    await runtime.dispose()
  })

  test('only returns voice history for the authenticated user', async () => {
    userMemoryRepository.reset()
    voiceHistoryMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const app = createApp({ runtime })
    const firstAccessToken = await registerAndGetAccessToken(app, 'voice-1@example.com')
    const secondAccessToken = await registerAndGetAccessToken(app, 'voice-2@example.com')

    runtime.voice = {
      async listProviders() {
        return [{ name: 'aliyun', available: true }]
      },
      async transcribeUpload(input) {
        return {
          provider: input.provider,
          language: input.language,
          text: '明天下午三点和张总在国贸喝咖啡',
          confidence: 0.96,
          segments: [],
        }
      },
      async synthesize() {
        return {
          provider: 'aliyun',
          mimeType: 'audio/mpeg',
          audio: Buffer.from('fake-mp3-audio'),
          durationMs: 1200,
        }
      },
      async startRealtimeSession() {
        throw new Error('unused in this test')
      },
    }

    const asrForm = new FormData()
    asrForm.set('audio', new File([Buffer.alloc(3200, 1)], 'sample.wav', { type: 'audio/wav' }))
    asrForm.set('language', 'zh-CN')
    asrForm.set('provider', 'aliyun')
    asrForm.set('enablePunctuation', 'true')

    await app.request('/api/v1/voice/asr', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firstAccessToken}`,
      },
      body: asrForm,
    })

    const secondHistoryResponse = await app.request('/api/v1/voice-history', {
      headers: {
        authorization: `Bearer ${secondAccessToken}`,
      },
    })
    const secondHistoryPayload = (await secondHistoryResponse.json()) as {
      data: {
        items: Array<{
          kind: string
        }>
      }
    }

    expect(secondHistoryResponse.status).toBe(200)
    expect(secondHistoryPayload.data.items).toHaveLength(0)

    await runtime.dispose()
  })

  test('validates uploaded audio and maps provider unavailability to voice error codes', async () => {
    userMemoryRepository.reset()
    voiceHistoryMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    runtime.voice = {
      async listProviders() {
        return [{ name: 'aliyun', available: false }]
      },
      async transcribeUpload() {
        throw new Error('provider should not be called for invalid input')
      },
      async synthesize() {
        throw new Error('provider should not be called in this test')
      },
      async startRealtimeSession() {
        throw new Error('provider should not be called in this test')
      },
    }
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app, 'voice-validation@example.com')

    const providersResponse = await app.request('/api/v1/voice/providers')
    const providersPayload = (await providersResponse.json()) as {
      data: {
        providers: Array<{
          name: string
          available: boolean
        }>
      }
    }

    expect(providersResponse.status).toBe(200)
    expect(providersPayload.data.providers).toEqual([{ name: 'aliyun', available: false }])

    const emptyAudioForm = new FormData()
    emptyAudioForm.set('audio', new File([Buffer.alloc(0)], 'empty.wav', { type: 'audio/wav' }))
    emptyAudioForm.set('language', 'zh-CN')
    emptyAudioForm.set('provider', 'aliyun')
    emptyAudioForm.set('enablePunctuation', 'true')

    const emptyAudioResponse = await app.request('/api/v1/voice/asr', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: emptyAudioForm,
    })
    const emptyAudioPayload = (await emptyAudioResponse.json()) as {
      error: {
        code: string
      }
    }

    expect(emptyAudioResponse.status).toBe(422)
    expect(emptyAudioPayload.error.code).toBe('VOICE_INPUT_EMPTY')

    const shortAudioForm = new FormData()
    shortAudioForm.set('audio', new File([Buffer.alloc(16, 1)], 'short.wav', { type: 'audio/wav' }))
    shortAudioForm.set('language', 'zh-CN')
    shortAudioForm.set('provider', 'aliyun')
    shortAudioForm.set('enablePunctuation', 'true')

    const shortAudioResponse = await app.request('/api/v1/voice/asr', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: shortAudioForm,
    })
    const shortAudioPayload = (await shortAudioResponse.json()) as {
      error: {
        code: string
      }
    }

    expect(shortAudioResponse.status).toBe(422)
    expect(shortAudioPayload.error.code).toBe('VOICE_INPUT_TOO_SHORT')

    runtime.voice = {
      async listProviders() {
        return [{ name: 'aliyun', available: true }]
      },
      async transcribeUpload() {
        throw new Error('VOICE_PROVIDER_UNAVAILABLE')
      },
      async synthesize() {
        throw new Error('VOICE_PROVIDER_UNAVAILABLE')
      },
      async startRealtimeSession() {
        throw new Error('VOICE_PROVIDER_UNAVAILABLE')
      },
    }

    const validAudioForm = new FormData()
    validAudioForm.set(
      'audio',
      new File([Buffer.alloc(3200, 1)], 'sample.wav', { type: 'audio/wav' }),
    )
    validAudioForm.set('language', 'zh-CN')
    validAudioForm.set('provider', 'aliyun')
    validAudioForm.set('enablePunctuation', 'true')

    const providerErrorResponse = await app.request('/api/v1/voice/asr', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      body: validAudioForm,
    })
    const providerErrorPayload = (await providerErrorResponse.json()) as {
      error: {
        code: string
      }
    }

    expect(providerErrorResponse.status).toBe(503)
    expect(providerErrorPayload.error.code).toBe('VOICE_PROVIDER_UNAVAILABLE')

    await runtime.dispose()
  })

  test('streams mock realtime ASR messages over websocket with accessToken query auth', async () => {
    userMemoryRepository.reset()
    voiceHistoryMemoryRepository.reset()
    const runtime = await createRuntimeDependencies(testEnv)
    const audioChunks: number[] = []
    runtime.voice = {
      async listProviders() {
        return [{ name: 'aliyun', available: true }]
      },
      async transcribeUpload() {
        return {
          provider: 'aliyun',
          language: 'zh-CN',
          text: 'unused',
          confidence: 1,
          segments: [],
        }
      },
      async synthesize() {
        return {
          provider: 'aliyun',
          mimeType: 'audio/mpeg',
          audio: Buffer.from('unused'),
          durationMs: 1000,
        }
      },
      async startRealtimeSession(input) {
        input.onPartial({
          text: '明天下午三点',
          confidence: 0.96,
        })

        return {
          async sendAudio(chunk) {
            audioChunks.push(chunk.byteLength)
          },
          async finish() {
            input.onFinal({
              text: '明天下午三点和张总开会',
              confidence: 0.97,
            })
          },
        }
      },
    }
    const app = createApp({ runtime })
    const accessToken = await registerAndGetAccessToken(app)
    const server = await startTestServer(runtime)

    try {
      const ws = await openWebSocket(
        `${server.baseUrl.replace('http', 'ws')}/api/v1/voice/asr/ws?accessToken=${accessToken}`,
      )
      const readJsonMessage = createJsonMessageReader(ws)
      const messages: Array<Record<string, unknown>> = []

      ws.send(
        JSON.stringify({
          type: 'session.start',
          audioFormat: 'pcm',
          sampleRate: 16000,
          language: 'zh-CN',
          enableIntermediateResult: true,
          enablePunctuation: true,
          enableInverseTextNormalization: true,
        }),
      )
      ws.send(Buffer.from('fake-audio-frame'))
      ws.send(JSON.stringify({ type: 'session.finish' }))

      for (let index = 0; index < 4; index += 1) {
        messages.push(await readJsonMessage())
      }

      expect(messages[0]).toEqual(
        expect.objectContaining({
          type: 'session.started',
          sessionId: expect.any(String),
        }),
      )
      expect(messages[1]).toEqual(
        expect.objectContaining({
          type: 'transcript.partial',
          text: expect.any(String),
          isFinal: false,
        }),
      )
      expect(messages[2]).toEqual(
        expect.objectContaining({
          type: 'transcript.final',
          text: expect.any(String),
          isFinal: true,
        }),
      )
      expect(messages[3]).toEqual(
        expect.objectContaining({
          type: 'session.finished',
        }),
      )

      expect(audioChunks).toEqual([16])

      const historyResponse = await app.request('/api/v1/voice-history', {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      })
      const historyPayload = (await historyResponse.json()) as {
        data: {
          items: Array<{
            kind: string
            provider: string
            resultSummary: Record<string, unknown>
          }>
        }
      }

      expect(historyResponse.status).toBe(200)
      expect(historyPayload.data.items[0]?.kind).toBe('asr')
      expect(historyPayload.data.items[0]?.provider).toBe('aliyun')
      expect(historyPayload.data.items[0]?.resultSummary).toEqual({
        text: '明天下午三点和张总开会',
        confidence: 0.97,
      })

      ws.close()
      await runtime.dispose()
    } finally {
      await server.close()
    }
  })
})

async function registerAndGetAccessToken(
  app: ReturnType<typeof createApp>,
  email = 'voice@example.com',
) {
  const response = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'strong-pass-123',
      name: 'Voice User',
    }),
  })
  const payload = (await response.json()) as {
    data: {
      accessToken: string
    }
  }

  return payload.data.accessToken
}

async function openWebSocket(url: string) {
  const ws = new WebSocket(url)

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      ws.off('open', onOpen)
      ws.off('error', onError)
    }

    ws.on('open', onOpen)
    ws.on('error', onError)
  })

  return ws
}

function createJsonMessageReader(ws: WebSocket) {
  const queue: string[] = []
  let resolvePending: ((value: string) => void) | null = null

  ws.on('message', (message, isBinary) => {
    const next = rawDataToString(message, isBinary)

    if (resolvePending) {
      const resolve = resolvePending

      resolvePending = null
      resolve(next)
      return
    }

    queue.push(next)
  })

  return async () => {
    const data =
      queue.shift() ??
      (await new Promise<string>((resolve, reject) => {
        resolvePending = resolve
        ws.once('error', reject)
      }))

    return JSON.parse(data) as Record<string, unknown>
  }
}

function rawDataToString(message: string | Buffer | ArrayBuffer | Buffer[], isBinary: boolean) {
  if (!isBinary) {
    if (typeof message === 'string') {
      return message
    }

    if (message instanceof ArrayBuffer) {
      return Buffer.from(message).toString()
    }

    if (Array.isArray(message)) {
      return Buffer.concat(message).toString()
    }

    return message.toString()
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString()
  }

  if (Array.isArray(message)) {
    return Buffer.concat(message).toString()
  }

  return Buffer.from(message).toString()
}

const testEnv = {
  PORT: '8061',
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://vocalendar:vocalendar@127.0.0.1:5432/vocalendar',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret',
  JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  ALIYUN_ACCESS_KEY_ID: 'akid',
  ALIYUN_ACCESS_KEY_SECRET: 'aksecret',
  ALIYUN_NLS_APP_KEY: 'appkey',
} as const
