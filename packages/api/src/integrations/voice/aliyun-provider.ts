import { createHmac, randomUUID } from 'node:crypto'

import { WebSocket } from 'ws'

import type { ApiEnv } from '../../config/env.js'
import type {
  VoiceProvider,
  VoiceProviderStatus,
  VoiceRealtimeSession,
  VoiceSynthesisResult,
  VoiceTranscriptionResult,
} from './types.js'

type FetchLike = typeof fetch
type RealtimeSocketLike = {
  on(event: 'open' | 'close' | 'error' | 'message', listener: (...args: unknown[]) => void): unknown
  off(
    event: 'open' | 'close' | 'error' | 'message',
    listener: (...args: unknown[]) => void,
  ): unknown
  send(data: string | Buffer): unknown
  close(): unknown
}
type RealtimeSocketFactory = (url: string) => RealtimeSocketLike

type CachedToken = {
  value: string
  expiresAt: number
}

export function createAliyunVoiceProvider(
  config: ApiEnv['voice']['aliyun'],
  fetchImpl: FetchLike = fetch,
  createRealtimeSocket: RealtimeSocketFactory = (url) => new WebSocket(url),
): VoiceProvider {
  let cachedToken: CachedToken | null = null

  return {
    async listProviders(): Promise<VoiceProviderStatus[]> {
      const available = await getToken()
        .then(() => true)
        .catch(() => false)

      return [
        {
          name: 'aliyun',
          available,
        },
      ]
    },

    async transcribeUpload(input): Promise<VoiceTranscriptionResult> {
      const token = await getToken()
      const url = new URL(gatewayHttpBase(config.gatewayUrl).replace(/\/$/, '') + '/stream/v1/asr')

      url.searchParams.set('appkey', config.nlsAppKey)
      url.searchParams.set('format', input.format)
      url.searchParams.set('sample_rate', '16000')
      url.searchParams.set('enable_punctuation_prediction', String(input.enablePunctuation))

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'X-NLS-Token': token,
          'Content-Type': 'application/octet-stream',
        },
        body: input.audio,
      })

      if (!response.ok) {
        throw providerUnavailable()
      }

      const payload = (await response.json().catch(() => null)) as {
        result?: string
      } | null

      if (!payload?.result) {
        throw providerUnavailable()
      }

      return {
        provider: 'aliyun',
        language: input.language,
        text: payload.result,
        confidence: 1,
        segments: [],
      }
    },

    async synthesize(input): Promise<VoiceSynthesisResult> {
      const token = await getToken()
      const url = gatewayHttpBase(config.gatewayUrl).replace(/\/$/, '') + '/stream/v1/tts'
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'X-NLS-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appkey: config.nlsAppKey,
          text: input.text,
          voice: input.voice,
          format: 'mp3',
          sample_rate: 16000,
          speech_rate: toSpeechRate(input.speed),
          enable_subtitle: false,
        }),
      })

      if (!response.ok) {
        throw providerUnavailable()
      }

      const audio = new Uint8Array(await response.arrayBuffer())

      return {
        provider: 'aliyun',
        mimeType: response.headers.get('content-type') ?? 'audio/mpeg',
        audio,
        durationMs: Math.max(input.text.length * 120, 800),
      }
    },

    async startRealtimeSession(input): Promise<VoiceRealtimeSession> {
      const token = await getToken()
      const url = new URL(config.gatewayUrl)

      url.searchParams.set('token', token)

      const socket = createRealtimeSocket(url.toString())
      const taskId = compactUuid(randomUUID())
      const startAck = createDeferred<void>()
      const stopAck = createDeferred<void>()
      let sessionStarted = false
      const onMessage = (message: unknown) => {
        const payload = parseRealtimeMessage(message)

        if (!payload) {
          return
        }

        const name = payload.header?.name
        const status = Number(payload.header?.status ?? 0)

        if (status && status !== 20000000) {
          console.error(
            `[aliyun-provider] realtime ASR error: status=${status}, name=${name ?? 'unknown'}`,
          )
          if (!sessionStarted) {
            startAck.reject(providerUnavailable())
          }
          stopAck.reject(providerUnavailable())
          return
        }

        if (name === 'TranscriptionStarted') {
          sessionStarted = true
          startAck.resolve()
          return
        }

        if (name === 'TranscriptionResultChanged') {
          input.onPartial({
            text: String(payload.payload?.result ?? ''),
            confidence: Number(payload.payload?.confidence ?? 0.96),
          })
          return
        }

        if (name === 'SentenceEnd') {
          input.onFinal({
            text: String(payload.payload?.result ?? ''),
            confidence: Number(payload.payload?.confidence ?? 0.97),
          })
          return
        }

        if (name === 'TranscriptionCompleted') {
          stopAck.resolve()
        }
      }
      const onError = () => {
        console.error('[aliyun-provider] realtime ASR websocket error')
        if (!sessionStarted) {
          startAck.reject(providerUnavailable())
        }
        stopAck.reject(providerUnavailable())
      }

      socket.on('message', onMessage)
      socket.on('error', onError)

      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          socket.off('open', handleOpen)
          socket.off('error', handleOpenError)
          resolve()
        }
        const handleOpenError = () => {
          socket.off('open', handleOpen)
          socket.off('error', handleOpenError)
          reject(providerUnavailable())
        }

        socket.on('open', handleOpen)
        socket.on('error', handleOpenError)
      })

      socket.send(
        JSON.stringify({
          header: {
            namespace: 'SpeechTranscriber',
            name: 'StartTranscription',
            appkey: config.nlsAppKey,
            message_id: compactUuid(randomUUID()),
            task_id: taskId,
          },
          payload: {
            format: input.audioFormat,
            sample_rate: input.sampleRate,
            enable_intermediate_result: input.enableIntermediateResult,
            enable_punctuation_prediction: input.enablePunctuation,
            enable_inverse_text_normalization: input.enableInverseTextNormalization,
          },
        }),
      )

      await startAck.promise

      return {
        async sendAudio(audio: Uint8Array) {
          socket.send(Buffer.from(audio))
        },
        async finish() {
          socket.send(
            JSON.stringify({
              header: {
                namespace: 'SpeechTranscriber',
                name: 'StopTranscription',
                appkey: config.nlsAppKey,
                message_id: compactUuid(randomUUID()),
                task_id: taskId,
              },
            }),
          )
          await stopAck.promise.catch(() => {
            // Swallow stop errors so finish() doesn't throw unhandled rejections.
            // Callers (voice.ts) already handle provider errors via WebSocket messages.
          })
          socket.close()
        },
      }
    },
  }

  async function getToken() {
    const nowSeconds = Math.floor(Date.now() / 1000)

    if (cachedToken && cachedToken.expiresAt - 60 > nowSeconds) {
      return cachedToken.value
    }

    const nonce = randomUUID()
    const timestamp = new Date().toISOString()
    const query = new URLSearchParams({
      AccessKeyId: config.accessKeyId,
      Action: 'CreateToken',
      Format: 'JSON',
      RegionId: config.asrRegion,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: nonce,
      SignatureVersion: '1.0',
      Timestamp: timestamp,
      Version: '2019-02-28',
    })
    const signature = signRpcRequest(query, config.accessKeySecret)

    query.set('Signature', signature)

    const url = new URL(`https://${config.tokenDomain}/`)

    url.search = query.toString()

    const response = await fetchImpl(url)

    if (!response.ok) {
      throw providerUnavailable()
    }

    const payload = (await response.json().catch(() => null)) as {
      Token?: {
        Id?: string
        ExpireTime?: number
      }
    } | null

    const tokenValue = payload?.Token?.Id
    const expiresAt = payload?.Token?.ExpireTime

    if (!tokenValue || !expiresAt) {
      throw providerUnavailable()
    }

    cachedToken = {
      value: tokenValue,
      expiresAt,
    }

    return tokenValue
  }
}

function gatewayHttpBase(gatewayUrl: string) {
  return gatewayUrl.replace(/^wss:/, 'https:').replace(/\/ws\/v1\/?$/, '')
}

function signRpcRequest(query: URLSearchParams, accessKeySecret: string) {
  const canonicalized = [...query.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&')
  const stringToSign = `GET&%2F&${percentEncode(canonicalized)}`

  return createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64')
}

function percentEncode(value: string) {
  return encodeURIComponent(value).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
}

function toSpeechRate(speed: number) {
  return Math.round((speed - 1) * 100)
}

function providerUnavailable() {
  return new Error('VOICE_PROVIDER_UNAVAILABLE')
}

function compactUuid(value: string) {
  return value.replaceAll('-', '')
}

function parseRealtimeMessage(message: unknown) {
  try {
    const raw =
      typeof message === 'string'
        ? message
        : Array.isArray(message)
          ? Buffer.concat(message).toString()
          : message instanceof Buffer
            ? message.toString()
            : Buffer.from(message as ArrayBuffer).toString()

    return JSON.parse(raw) as {
      header?: {
        name?: string
        status?: number
      }
      payload?: Record<string, unknown>
    }
  } catch {
    return null
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}
