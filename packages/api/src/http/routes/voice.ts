import { upgradeWebSocket } from '@hono/node-server'
import { voiceAsrWsStartMessageSchema } from '@vocalendar/schemas'
import { Hono } from 'hono'
import { z } from 'zod'

import type { RuntimeDependencies } from '../../config/runtime.js'
import type { VoiceRealtimeSession } from '../../integrations/voice/types.js'
import { nowIso } from '../../utils/clock.js'
import { ok, validationError } from '../utils/responses.js'

type VoiceWsContext = {
  raw: {
    send: (data: string) => void
    __sessionId?: string
    __language?: string
    __sampleRate?: number
    __audioFormat?: string
    __enableIntermediateResult?: boolean
    __realtimeSession?: VoiceRealtimeSession
    __finalTranscript?: {
      text: string
      confidence: number
    }
    __pendingAudioChunks?: Uint8Array[]
    __pendingFinishRequested?: boolean
  }
  send: (data: string) => void
}

const voiceAsrSchema = z.object({
  language: z.string().min(1),
  provider: z.string().min(1),
  enablePunctuation: z.boolean(),
})

const voiceTtsSchema = z.object({
  text: z.string().min(1),
  language: z.string().min(1),
  voice: z.string().min(1),
  speed: z.number().positive(),
})

export function createVoiceRoutes(runtime: RuntimeDependencies) {
  const voiceRoutes = new Hono()

  voiceRoutes.get('/providers', async (c) => {
    return ok(c, {
      providers: await runtime.voice.listProviders(),
    })
  })

  voiceRoutes.post('/asr', async (c) => {
    const formData = await c.req.formData().catch(() => null)

    if (!formData) {
      return validationError(c, { formData: ['multipart/form-data body is required.'] })
    }

    const audio = formData.get('audio')
    const result = voiceAsrSchema.safeParse({
      language: formData.get('language'),
      provider: formData.get('provider'),
      enablePunctuation: coerceBoolean(formData.get('enablePunctuation')),
    })

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    if (!(audio instanceof File)) {
      return validationError(c, { audio: ['audio file is required.'] })
    }

    const audioBytes = new Uint8Array(await audio.arrayBuffer())

    if (audioBytes.byteLength === 0) {
      return voiceErrorResponse(c, 422, 'VOICE_INPUT_EMPTY', 'Audio input is empty.')
    }

    if (audioBytes.byteLength < 32) {
      return voiceErrorResponse(c, 422, 'VOICE_INPUT_TOO_SHORT', 'Audio input is too short.')
    }

    const format = inferAudioFormat(audio)

    try {
      const transcription = await runtime.voice.transcribeUpload({
        provider: result.data.provider,
        language: result.data.language,
        format,
        audio: audioBytes,
        enablePunctuation: result.data.enablePunctuation,
      })

      await runtime.repositories.voiceHistory.add(
        {
          id: `vh_${crypto.randomUUID()}`,
          kind: 'asr',
          provider: transcription.provider,
          language: transcription.language,
          requestSummary: {
            provider: result.data.provider,
            format,
            byteLength: audioBytes.byteLength,
            enablePunctuation: result.data.enablePunctuation,
          },
          resultSummary: {
            text: transcription.text,
            confidence: transcription.confidence,
            segments: transcription.segments,
          },
          createdAt: nowIso(),
        },
        c.get('currentUser')?.id ?? null,
      )

      return ok(c, {
        text: transcription.text,
        language: transcription.language,
        confidence: transcription.confidence,
        segments: transcription.segments,
      })
    } catch (error) {
      return mapVoiceProviderError(c, error)
    }
  })

  voiceRoutes.get(
    '/asr/ws',
    async (c, next) => {
      const accessToken = c.req.query('accessToken')

      if (!accessToken) {
        return unauthorizedWsResponse('Access token is required.')
      }

      const payload = await runtime.tokens.verifyAccessToken(accessToken).catch(() => null)

      if (!payload) {
        return unauthorizedWsResponse('Access token is invalid.')
      }

      c.set('wsUserId', payload.sub)
      await next()
    },
    upgradeWebSocket((c) => {
      const userId = c.get('wsUserId') as string

      return {
        onMessage(event, ws) {
        const context = ws as unknown as VoiceWsContext
        const finishRealtimeSession = async (sessionId: string) => {
          await currentRealtimeSession(context)?.finish()

          const finalTranscript = context.raw.__finalTranscript

          if (finalTranscript) {
            await runtime.repositories.voiceHistory.add(
              {
                id: `vh_${crypto.randomUUID()}`,
                kind: 'asr',
                provider: 'aliyun',
                language: context.raw.__language ?? 'zh-CN',
                requestSummary: {
                  sampleRate: context.raw.__sampleRate ?? 16000,
                  audioFormat: context.raw.__audioFormat ?? 'pcm',
                  enableIntermediateResult: context.raw.__enableIntermediateResult ?? true,
                },
                resultSummary: {
                  text: finalTranscript.text,
                  confidence: finalTranscript.confidence,
                },
                createdAt: nowIso(),
              },
              userId,
            )
          }

          context.send(
            JSON.stringify({
              type: 'session.finished',
              sessionId,
            }),
          )
        }

        if (typeof event.data !== 'string') {
          const audioBytes = binaryDataToBytes(event.data)
          const session = currentRealtimeSession(context)

          if (!session) {
            queuePendingAudio(context, audioBytes)
            return
          }

          void session.sendAudio(audioBytes).catch(() => {
            context.send(
              JSON.stringify({
                type: 'error',
                code: 'VOICE_PROVIDER_UNAVAILABLE',
                message: 'Aliyun realtime ASR failed.',
              }),
            )
          })
          return
        }

        const parsed = JSON.parse(event.data) as { type?: string }

        if (parsed.type === 'session.start') {
          const startResult = voiceAsrWsStartMessageSchema.safeParse(parsed)

          if (!startResult.success) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'VALIDATION_ERROR',
                message: 'Invalid realtime ASR session.start payload.',
              }),
            )
            return
          }

          const sessionId = `vasr_${crypto.randomUUID()}`

          setSessionId(context, sessionId)
          setSessionMetadata(context, {
            language: startResult.data.language,
            sampleRate: startResult.data.sampleRate,
            audioFormat: startResult.data.audioFormat,
            enableIntermediateResult: startResult.data.enableIntermediateResult,
          })
          let sessionStarted = false
          const pendingMessages: string[] = []
          const sendSessionMessage = (message: string) => {
            if (!sessionStarted) {
              pendingMessages.push(message)
              return
            }

            context.send(message)
          }
          void runtime.voice
            .startRealtimeSession({
              language: startResult.data.language,
              sampleRate: startResult.data.sampleRate,
              audioFormat: startResult.data.audioFormat,
              enableIntermediateResult: startResult.data.enableIntermediateResult,
              enablePunctuation: startResult.data.enablePunctuation,
              enableInverseTextNormalization: startResult.data.enableInverseTextNormalization,
              onPartial(result) {
                sendSessionMessage(
                  JSON.stringify({
                    type: 'transcript.partial',
                    sessionId,
                    text: result.text,
                    confidence: result.confidence,
                    isFinal: false,
                  }),
                )
              },
              onFinal(result) {
                setFinalTranscript(context, result)
                sendSessionMessage(
                  JSON.stringify({
                    type: 'transcript.final',
                    sessionId,
                    text: result.text,
                    confidence: result.confidence,
                    isFinal: true,
                  }),
                )
              },
            })
            .then((session) => {
              setRealtimeSession(context, session)
              sessionStarted = true
              context.send(
                JSON.stringify({
                  type: 'session.started',
                  sessionId,
                }),
              )
              for (const message of pendingMessages) {
                context.send(message)
              }
              for (const chunk of consumePendingAudio(context)) {
                void session.sendAudio(chunk).catch(() => {
                  context.send(
                    JSON.stringify({
                      type: 'error',
                      code: 'VOICE_PROVIDER_UNAVAILABLE',
                      message: 'Aliyun realtime ASR failed.',
                    }),
                  )
                })
              }
              if (consumePendingFinishRequested(context)) {
                void finishRealtimeSession(sessionId).catch(() => {
                  context.send(
                    JSON.stringify({
                      type: 'error',
                      code: 'VOICE_PROVIDER_UNAVAILABLE',
                      message: 'Aliyun realtime ASR failed.',
                    }),
                  )
                })
              }
            })
            .catch(() => {
              context.send(
                JSON.stringify({
                  type: 'error',
                  code: 'VOICE_PROVIDER_UNAVAILABLE',
                  message: 'Aliyun realtime ASR failed.',
                }),
              )
            })
          return
        }

        if (parsed.type === 'session.finish') {
          const sessionId = currentSessionId(context)

          if (!sessionId) {
            context.send(
              JSON.stringify({
                type: 'error',
                code: 'VALIDATION_ERROR',
                message: 'Realtime ASR session has not been started.',
              }),
            )
            return
          }

          if (!currentRealtimeSession(context)) {
            setPendingFinishRequested(context)
            return
          }

          void finishRealtimeSession(sessionId).catch(() => {
            context.send(
              JSON.stringify({
                type: 'error',
                code: 'VOICE_PROVIDER_UNAVAILABLE',
                message: 'Aliyun realtime ASR failed.',
              }),
            )
          })
        }
      },
    }
  }),
)

  voiceRoutes.post('/tts', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = voiceTtsSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const synthesis = await runtime.voice.synthesize({
        text: result.data.text,
        language: result.data.language,
        voice: result.data.voice,
        speed: result.data.speed,
      })

      await runtime.repositories.voiceHistory.add(
        {
          id: `vh_${crypto.randomUUID()}`,
          kind: 'tts',
          provider: synthesis.provider,
          language: result.data.language,
          requestSummary: {
            text: result.data.text,
            voice: result.data.voice,
            speed: result.data.speed,
          },
          resultSummary: {
            durationMs: synthesis.durationMs,
            mimeType: synthesis.mimeType,
          },
          createdAt: nowIso(),
        },
        c.get('currentUser')?.id ?? null,
      )

      return ok(c, {
        audioUrl: `data:${synthesis.mimeType};base64,${Buffer.from(synthesis.audio).toString('base64')}`,
        durationMs: synthesis.durationMs,
        mimeType: synthesis.mimeType,
      })
    } catch (error) {
      return mapVoiceProviderError(c, error)
    }
  })

  return voiceRoutes
}

export function createVoiceHistoryRoutes(runtime: RuntimeDependencies) {
  const voiceHistoryRoutes = new Hono()

  voiceHistoryRoutes.get('/', async (c) => {
    return ok(c, {
      items: await runtime.repositories.voiceHistory.list(c.get('currentUser')?.id ?? null),
    })
  })

  return voiceHistoryRoutes
}

function unauthorizedWsResponse(message: string) {
  return Response.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message,
        details: null,
      },
      meta: {
        requestId: 'dev-request',
        timestamp: nowIso(),
      },
    },
    {
      status: 401,
    },
  )
}

function currentSessionId(ws: VoiceWsContext) {
  return ws.raw.__sessionId ?? null
}

function setSessionId(ws: VoiceWsContext, sessionId: string) {
  ws.raw.__sessionId = sessionId
}

function setSessionMetadata(
  ws: VoiceWsContext,
  input: {
    language: string
    sampleRate: number
    audioFormat: string
    enableIntermediateResult: boolean
  },
) {
  ws.raw.__language = input.language
  ws.raw.__sampleRate = input.sampleRate
  ws.raw.__audioFormat = input.audioFormat
  ws.raw.__enableIntermediateResult = input.enableIntermediateResult
}

function setRealtimeSession(ws: VoiceWsContext, session: VoiceRealtimeSession) {
  ws.raw.__realtimeSession = session
}

function currentRealtimeSession(ws: VoiceWsContext) {
  return ws.raw.__realtimeSession ?? null
}

function setFinalTranscript(
  ws: VoiceWsContext,
  transcript: {
    text: string
    confidence: number
  },
) {
  ws.raw.__finalTranscript = transcript
}

function queuePendingAudio(ws: VoiceWsContext, chunk: Uint8Array) {
  ws.raw.__pendingAudioChunks = [...(ws.raw.__pendingAudioChunks ?? []), chunk]
}

function consumePendingAudio(ws: VoiceWsContext) {
  const chunks = ws.raw.__pendingAudioChunks ?? []

  ws.raw.__pendingAudioChunks = []

  return chunks
}

function setPendingFinishRequested(ws: VoiceWsContext) {
  ws.raw.__pendingFinishRequested = true
}

function consumePendingFinishRequested(ws: VoiceWsContext) {
  const requested = ws.raw.__pendingFinishRequested ?? false

  ws.raw.__pendingFinishRequested = false

  return requested
}

function inferAudioFormat(audio: File) {
  const extension = audio.name.split('.').at(-1)?.trim().toLowerCase()

  if (extension && extension.length > 0) {
    return extension
  }

  if (audio.type.includes('/')) {
    return audio.type.split('/').at(-1) ?? 'bin'
  }

  return 'bin'
}

function coerceBoolean(value: string | File | null) {
  if (typeof value === 'string') {
    return value === 'true'
  }

  return false
}

function binaryDataToBytes(data: ArrayBuffer | Blob | Buffer | Buffer[]) {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }

  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data))
  }

  if (data instanceof Buffer) {
    return new Uint8Array(data)
  }

  throw new Error('Blob audio frames are not supported in this runtime.')
}

function mapVoiceProviderError(c: Parameters<typeof ok>[0], error: unknown) {
  const code =
    error instanceof Error && error.message === 'VOICE_PROVIDER_UNAVAILABLE'
      ? 'VOICE_PROVIDER_UNAVAILABLE'
      : 'INTERNAL_ERROR'

  const status = code === 'VOICE_PROVIDER_UNAVAILABLE' ? 503 : 500
  const message =
    code === 'VOICE_PROVIDER_UNAVAILABLE'
      ? 'Voice provider is unavailable.'
      : 'Voice request failed.'

  return voiceErrorResponse(c, status, code, message)
}

function voiceErrorResponse(
  c: Parameters<typeof ok>[0],
  status: number,
  code: string,
  message: string,
) {
  return c.json(
    {
      error: {
        code,
        message,
        details: null,
      },
      meta: {
        requestId: c.req.header('x-request-id') ?? 'dev-request',
        timestamp: nowIso(),
      },
    },
    status as 400 | 401 | 403 | 404 | 422 | 500 | 503,
  )
}
