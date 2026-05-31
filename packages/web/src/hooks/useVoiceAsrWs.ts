import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiBaseUrl } from '../lib/api-client'

type VoiceAsrWsStatus = 'idle' | 'connecting' | 'listening' | 'finishing' | 'finished' | 'error'

export interface VoiceAsrWsState {
  status: VoiceAsrWsStatus
  partialText: string
  finalText: string
  error: string | null
}

export function useVoiceAsrWs(accessToken: string | null) {
  const [state, setState] = useState<VoiceAsrWsState>({
    status: 'idle',
    partialText: '',
    finalText: '',
    error: null,
  })

  const socketRef = useRef<WebSocket | null>(null)
  const pendingAudioRef = useRef<Uint8Array[]>([])
  const pendingFinishRef = useRef(false)
  const statusRef = useRef<VoiceAsrWsStatus>('idle')

  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  const startSession = useCallback(
    (language = 'zh-CN') => {
      if (!accessToken) {
        setState({
          status: 'error',
          partialText: '',
          finalText: '',
          error: '未登录，无法启动语音识别。',
        })
        return
      }

      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }

      pendingAudioRef.current = []
      pendingFinishRef.current = false

      const baseUrl = getApiBaseUrl()
      const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/api/v1/voice/asr/ws?accessToken=${encodeURIComponent(accessToken)}`

      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.binaryType = 'arraybuffer'

      socket.addEventListener('open', () => {
        setState({ status: 'connecting', partialText: '', finalText: '', error: null })
        socket.send(
          JSON.stringify({
            type: 'session.start',
            audioFormat: 'pcm',
            sampleRate: 16000,
            language,
            enableIntermediateResult: true,
            enablePunctuation: true,
            enableInverseTextNormalization: true,
          }),
        )
      })

      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') return

        let message: {
          type: string
          sessionId?: string
          text?: string
          confidence?: number
          isFinal?: boolean
          code?: string
          message?: string
        }

        try {
          message = JSON.parse(event.data) as typeof message
        } catch {
          return
        }

        switch (message.type) {
          case 'session.started': {
            setState((prev) => ({ ...prev, status: 'listening' }))
            for (const chunk of pendingAudioRef.current) {
              socket.send(chunk.slice().buffer)
            }
            pendingAudioRef.current = []
            if (pendingFinishRef.current) {
              pendingFinishRef.current = false
              setState((prev) => ({ ...prev, status: 'finishing' }))
              socket.send(JSON.stringify({ type: 'session.finish' }))
            }
            break
          }
          case 'transcript.partial': {
            setState((prev) => ({
              ...prev,
              partialText: message.text ?? '',
            }))
            break
          }
          case 'transcript.final': {
            setState((prev) => ({
              ...prev,
              partialText: '',
              finalText: prev.finalText + (message.text ?? ''),
            }))
            break
          }
          case 'session.finished': {
            statusRef.current = 'finished'
            setState((prev) => ({ ...prev, status: 'finished' }))
            socket.close()
            socketRef.current = null
            break
          }
          case 'error': {
            statusRef.current = 'error'
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: message.message ?? message.code ?? '语音识别出错',
            }))
            socket.close()
            socketRef.current = null
            break
          }
        }
      })

      socket.addEventListener('error', () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'WebSocket 连接出错',
        }))
      })

      socket.addEventListener('close', () => {
        if (statusRef.current !== 'finished' && statusRef.current !== 'error') {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: prev.error ?? '连接已关闭',
          }))
        }
        socketRef.current = null
      })
    },
    [accessToken],
  )

  const sendAudio = useCallback((pcmChunk: Int16Array) => {
    const bytes = new Uint8Array(pcmChunk.buffer, pcmChunk.byteOffset, pcmChunk.byteLength)
    const currentStatus = statusRef.current

    if (currentStatus === 'listening' && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(bytes.slice().buffer)
    } else if (currentStatus === 'connecting') {
      pendingAudioRef.current.push(bytes)
    }
  }, [])

  const finishSession = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && statusRef.current === 'listening') {
      setState((prev) => ({ ...prev, status: 'finishing' }))
      socketRef.current.send(JSON.stringify({ type: 'session.finish' }))
    } else if (statusRef.current === 'connecting') {
      pendingFinishRef.current = true
    }
  }, [])

  const reset = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    pendingAudioRef.current = []
    pendingFinishRef.current = false
    setState({ status: 'idle', partialText: '', finalText: '', error: null })
  }, [])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [])

  return { state, startSession, sendAudio, finishSession, reset }
}
