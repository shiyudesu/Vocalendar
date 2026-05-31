import { afterEach, describe, expect, test, vi } from 'vitest'

import { createAliyunVoiceProvider } from './aliyun-provider.js'

const fixedNow = new Date('2026-06-01T00:00:00.000Z')
type FetchInput = string | URL | Request

describe('createAliyunVoiceProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('fetches and caches NLS tokens for provider status and upload ASR requests', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    const fetchCalls: Array<{ input: FetchInput; init?: RequestInit }> = []
    const fetchStub = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      fetchCalls.push({ input, init })

      const url = String(input)

      if (url.startsWith('https://nls-meta.cn-shanghai.aliyuncs.com/')) {
        return new Response(
          JSON.stringify({
            Token: {
              Id: 'tok_cached',
              ExpireTime: Math.floor(new Date('2026-06-01T01:00:00.000Z').getTime() / 1000),
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      if (url.startsWith('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr')) {
        return new Response(
          JSON.stringify({
            status: 20000000,
            result: '明天下午三点和张总开会',
            message: 'SUCCESS',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    const provider = createAliyunVoiceProvider(
      {
        accessKeyId: 'akid',
        accessKeySecret: 'aksecret',
        nlsAppKey: 'appkey',
        asrRegion: 'cn-shanghai',
        ttsRegion: 'cn-shanghai',
        gatewayUrl: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
        tokenDomain: 'nls-meta.cn-shanghai.aliyuncs.com',
        tokenTtlSeconds: 3600,
        defaultLanguage: 'zh-CN',
      },
      fetchStub,
    )

    expect(await provider.listProviders()).toEqual([{ name: 'aliyun', available: true }])

    const transcription = await provider.transcribeUpload({
      provider: 'aliyun',
      language: 'zh-CN',
      format: 'wav',
      audio: new Uint8Array([1, 2, 3, 4]),
      enablePunctuation: true,
    })

    expect(transcription).toEqual({
      provider: 'aliyun',
      language: 'zh-CN',
      text: '明天下午三点和张总开会',
      confidence: 1,
      segments: [],
    })

    const tokenCalls = fetchCalls.filter(({ input }) =>
      String(input).startsWith('https://nls-meta.cn-shanghai.aliyuncs.com/'),
    )
    const asrCall = fetchCalls.find(({ input }) =>
      String(input).startsWith('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr'),
    )

    expect(tokenCalls).toHaveLength(1)
    expect(String(tokenCalls[0]?.input)).toContain('Action=CreateToken')
    expect(String(tokenCalls[0]?.input)).toContain('Version=2019-02-28')
    expect(String(tokenCalls[0]?.input)).toContain('AccessKeyId=akid')
    expect(String(tokenCalls[0]?.input)).toContain('SignatureMethod=HMAC-SHA1')
    expect(String(tokenCalls[0]?.input)).toContain('Signature=')
    expect(asrCall).toBeDefined()
    expect(asrCall?.init?.method).toBe('POST')
    expect((asrCall?.init?.headers as Record<string, string>)['X-NLS-Token']).toBe('tok_cached')
    expect((asrCall?.init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/octet-stream',
    )
    expect(String(asrCall?.input)).toContain('/stream/v1/asr?')
    expect(String(asrCall?.input)).toContain('appkey=appkey')
    expect(String(asrCall?.input)).toContain('format=wav')
    expect(String(asrCall?.input)).toContain('sample_rate=16000')
    expect(String(asrCall?.input)).toContain('enable_punctuation_prediction=true')
  })

  test('uses the tokenized TTS endpoint and returns binary audio payloads', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    const fetchStub = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      const url = String(input)

      if (url.startsWith('https://nls-meta.cn-shanghai.aliyuncs.com/')) {
        return new Response(
          JSON.stringify({
            Token: {
              Id: 'tok_tts',
              ExpireTime: Math.floor(new Date('2026-06-01T01:00:00.000Z').getTime() / 1000),
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      if (url === 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts') {
        expect(init?.method).toBe('POST')
        expect((init?.headers as Record<string, string>)['X-NLS-Token']).toBe('tok_tts')
        expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
        expect(init?.body).toBeDefined()

        return new Response(Buffer.from('fake-mp3-audio'), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        })
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    const provider = createAliyunVoiceProvider(
      {
        accessKeyId: 'akid',
        accessKeySecret: 'aksecret',
        nlsAppKey: 'appkey',
        asrRegion: 'cn-shanghai',
        ttsRegion: 'cn-shanghai',
        gatewayUrl: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
        tokenDomain: 'nls-meta.cn-shanghai.aliyuncs.com',
        tokenTtlSeconds: 3600,
        defaultLanguage: 'zh-CN',
      },
      fetchStub,
    )

    const synthesis = await provider.synthesize({
      text: '已为您创建明天下午三点的客户会议',
      language: 'zh-CN',
      voice: 'xiaoyun',
      speed: 1,
    })

    expect(synthesis.provider).toBe('aliyun')
    expect(synthesis.mimeType).toBe('audio/mpeg')
    expect(Buffer.from(synthesis.audio).toString()).toBe('fake-mp3-audio')
    expect(synthesis.durationMs).toBeGreaterThan(0)
  })

  test('marks provider unavailable when token fetch fails', async () => {
    const provider = createAliyunVoiceProvider(
      {
        accessKeyId: 'akid',
        accessKeySecret: 'aksecret',
        nlsAppKey: 'appkey',
        asrRegion: 'cn-shanghai',
        ttsRegion: 'cn-shanghai',
        gatewayUrl: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
        tokenDomain: 'nls-meta.cn-shanghai.aliyuncs.com',
        tokenTtlSeconds: 3600,
        defaultLanguage: 'zh-CN',
      },
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    expect(await provider.listProviders()).toEqual([{ name: 'aliyun', available: false }])
  })

  test('opens realtime ASR websocket sessions and maps provider events', async () => {
    const sentFrames: Array<string | Buffer> = []
    const socket = createFakeRealtimeSocket(sentFrames)
    const fetchStub = vi.fn(async (input: FetchInput) => {
      const url = String(input)

      if (url.startsWith('https://nls-meta.cn-shanghai.aliyuncs.com/')) {
        return new Response(
          JSON.stringify({
            Token: {
              Id: 'tok_ws',
              ExpireTime: Math.floor(new Date('2026-06-01T01:00:00.000Z').getTime() / 1000),
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    const provider = createAliyunVoiceProvider(
      {
        accessKeyId: 'akid',
        accessKeySecret: 'aksecret',
        nlsAppKey: 'appkey',
        asrRegion: 'cn-shanghai',
        ttsRegion: 'cn-shanghai',
        gatewayUrl: 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1',
        tokenDomain: 'nls-meta.cn-shanghai.aliyuncs.com',
        tokenTtlSeconds: 3600,
        defaultLanguage: 'zh-CN',
      },
      fetchStub,
      () => socket,
    )
    const partials: string[] = []
    const finals: string[] = []
    const sessionPromise = provider.startRealtimeSession({
      language: 'zh-CN',
      sampleRate: 16000,
      audioFormat: 'pcm',
      enableIntermediateResult: true,
      enablePunctuation: true,
      enableInverseTextNormalization: true,
      onPartial(result) {
        partials.push(result.text)
      },
      onFinal(result) {
        finals.push(result.text)
      },
    })

    await waitFor(() => socket.listenerCount('open') > 0)
    socket.emit('open')
    await waitFor(() => sentFrames.length > 0)
    expect(sentFrames).toHaveLength(1)
    const startFrame = JSON.parse(String(sentFrames[0])) as {
      header: {
        namespace: string
        name: string
        appkey: string
        message_id: string
        task_id: string
      }
      payload: {
        format: string
        sample_rate: number
        enable_intermediate_result: boolean
        enable_punctuation_prediction: boolean
        enable_inverse_text_normalization: boolean
      }
    }

    expect(startFrame.header.namespace).toBe('SpeechTranscriber')
    expect(startFrame.header.name).toBe('StartTranscription')
    expect(startFrame.header.appkey).toBe('appkey')
    expect(startFrame.header.message_id).toMatch(/^[0-9a-f]{32}$/)
    expect(startFrame.header.task_id).toMatch(/^[0-9a-f]{32}$/)
    expect(startFrame.payload).toEqual({
      format: 'pcm',
      sample_rate: 16000,
      enable_intermediate_result: true,
      enable_punctuation_prediction: true,
      enable_inverse_text_normalization: true,
    })

    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          header: {
            name: 'TranscriptionStarted',
            status: 20000000,
          },
          payload: {
            session_id: 'session-1',
          },
        }),
      ),
    )
    const session = await sessionPromise

    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          header: {
            name: 'TranscriptionResultChanged',
            status: 20000000,
          },
          payload: {
            result: '明天下午三点',
          },
        }),
      ),
    )
    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          header: {
            name: 'SentenceEnd',
            status: 20000000,
          },
          payload: {
            result: '明天下午三点和张总开会',
            confidence: 0.97,
          },
        }),
      ),
    )

    await session.sendAudio(new Uint8Array([1, 2, 3, 4]))
    expect(Buffer.isBuffer(sentFrames[1])).toBe(true)
    expect(partials).toEqual(['明天下午三点'])
    expect(finals).toEqual(['明天下午三点和张总开会'])

    const finishPromise = session.finish()
    expect(sentFrames).toHaveLength(3)
    const stopFrame = JSON.parse(String(sentFrames[2])) as {
      header: {
        namespace: string
        name: string
      }
    }

    expect(stopFrame.header.namespace).toBe('SpeechTranscriber')
    expect(stopFrame.header.name).toBe('StopTranscription')

    socket.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          header: {
            name: 'TranscriptionCompleted',
            status: 20000000,
          },
        }),
      ),
    )

    await finishPromise
    expect(socket.closed).toBe(true)
  })
})

function createFakeRealtimeSocket(sentFrames: Array<string | Buffer>) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()

  return {
    closed: false,
    on(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
      return this
    },
    off(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
      )
      return this
    },
    send(data: string | Buffer) {
      sentFrames.push(data)
    },
    listenerCount(event: string) {
      return (listeners.get(event) ?? []).length
    },
    close() {
      this.closed = true
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args)
      }
    },
  }
}

async function waitFor(predicate: () => boolean, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  throw new Error('Condition was not met in time.')
}
