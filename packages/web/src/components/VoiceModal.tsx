import { Mic, MicOff, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useVoiceAsrWs } from '../hooks/useVoiceAsrWs'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import type { VoiceHistoryItem } from '../lib/models'
import { quickCommands } from '../lib/voice-ui'

type UiStatus = 'idle' | 'recording' | 'recognizing' | 'confirm' | 'error'

interface VoiceModalProps {
  onClose: () => void
  accessToken: string | null
  language: string
  voiceHistory: VoiceHistoryItem[]
  onTranscriptReady: (transcript: string) => void
}

export function VoiceModal({
  onClose,
  accessToken,
  language,
  voiceHistory,
  onTranscriptReady,
}: VoiceModalProps) {
  const [uiStatus, setUiStatus] = useState<UiStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)

  const onTranscriptReadyRef = useRef(onTranscriptReady)
  onTranscriptReadyRef.current = onTranscriptReady

  const {
    state: asrState,
    startSession,
    sendAudio,
    finishSession,
    reset,
  } = useVoiceAsrWs(accessToken)

  const handlePcmChunk = useCallback(
    (chunk: Int16Array) => {
      sendAudio(chunk)
    },
    [sendAudio],
  )

  const { state: recorderState, startRecording, stopRecording } = useVoiceRecorder(handlePcmChunk)

  // Cleanup on unmount or when modal closes externally
  useEffect(() => {
    return () => {
      stopRecording()
      reset()
    }
  }, [stopRecording, reset])

  // Escape key closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Sync recorder error to UI
  useEffect(() => {
    if (recorderState.error) {
      setErrorMessage(recorderState.error)
      setUiStatus('error')
      reset()
    }
  }, [recorderState.error, reset])

  // Sync ASR status to UI
  useEffect(() => {
    if (asrState.error && uiStatus !== 'error') {
      setErrorMessage(asrState.error)
      setUiStatus('error')
      return
    }

    if (asrState.status === 'finished') {
      setUiStatus('confirm')
      return
    }

    if (recorderState.isRecording) {
      setUiStatus('recording')
      return
    }

    if (asrState.status === 'finishing') {
      setUiStatus('recognizing')
    }
  }, [asrState.status, asrState.error, recorderState.isRecording, uiStatus])

  async function handleStartRecording() {
    setPendingCommand(null)
    setErrorMessage('')
    reset()
    setUiStatus('idle')
    startSession(language)
    await startRecording()
  }

  function handleStopRecording() {
    stopRecording()
    finishSession()
  }

  function handleConfirmTranscript() {
    const text = pendingCommand ?? asrState.finalText
    if (text) {
      onClose()
      onTranscriptReadyRef.current(text)
    }
  }

  function handleRetry() {
    setPendingCommand(null)
    setErrorMessage('')
    reset()
    setUiStatus('idle')
  }

  function handleQuickCommand(command: string) {
    stopRecording()
    reset()
    setPendingCommand(command)
    setUiStatus('confirm')
  }

  // Volume bars based on real audio
  const volumeBars = Array.from({ length: 20 }, () => {
    if (!recorderState.isRecording || recorderState.volume === 0) return 3
    const normalized = Math.min(1, recorderState.volume * 4)
    return Math.round(normalized * 28 + 4)
  })

  const displayText = pendingCommand || asrState.partialText || asrState.finalText || ''

  const statusTitle = {
    idle: pendingCommand ? '快捷指令' : '按住说话',
    recording: '正在聆听...',
    recognizing: '正在解析...',
    confirm: '请确认',
    error: '出错了',
  }[uiStatus]

  const statusDesc = {
    idle: pendingCommand ? `「${pendingCommand}」` : '说出您的日程安排',
    recording: '请描述您的事件',
    recognizing: '识别中，请稍候',
    confirm: '确认信息是否正确',
    error: errorMessage || '请检查麦克风权限或网络连接',
  }[uiStatus]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="关闭"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="px-8 pt-8 pb-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">{statusTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">{statusDesc}</p>
          </div>

          {recorderState.isRecording && (
            <div className="mt-6 flex h-10 items-center justify-center gap-0.5">
              {volumeBars.map((height, i) => (
                <div
                  className="w-1.5 rounded-full bg-teal-500 transition-all duration-75"
                  key={i}
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          )}

          {displayText && uiStatus !== 'idle' && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-relaxed text-slate-700">「{displayText}」</p>
            </div>
          )}

          {uiStatus === 'confirm' && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-start gap-2">
                <Volume2 size={16} className="mt-0.5 shrink-0 text-teal-600" />
                <p className="text-sm leading-relaxed text-teal-800">
                  {pendingCommand
                    ? `执行：${quickCommands.find((c) => c.command === pendingCommand)?.action ?? pendingCommand}，确认吗？`
                    : '识别结果如上，确认吗？'}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
                  onClick={handleConfirmTranscript}
                  type="button"
                >
                  对的，确认
                </button>
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={handleRetry}
                  type="button"
                >
                  不对，重说
                </button>
              </div>
            </div>
          )}

          {uiStatus === 'error' && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
              <p className="text-sm text-rose-700">{errorMessage || '语音识别失败，请重试。'}</p>
              <button
                className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                onClick={handleRetry}
                type="button"
              >
                重试
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all ${
                recorderState.isRecording
                  ? 'animate-pulse bg-rose-500 text-white shadow-rose-200'
                  : 'bg-slate-900 text-white shadow-slate-300 hover:scale-105 hover:bg-teal-700'
              }`}
              onMouseDown={() => {
                if (uiStatus === 'idle' || uiStatus === 'confirm' || uiStatus === 'error') {
                  void handleStartRecording()
                }
              }}
              onMouseUp={() => {
                if (recorderState.isRecording) handleStopRecording()
              }}
              onTouchStart={() => {
                if (uiStatus === 'idle' || uiStatus === 'confirm' || uiStatus === 'error') {
                  void handleStartRecording()
                }
              }}
              onTouchEnd={() => {
                if (recorderState.isRecording) handleStopRecording()
              }}
              type="button"
            >
              {recorderState.isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            {recorderState.isRecording ? '松开结束录音' : '按住麦克风按钮开始说话'}
          </p>
        </div>

        <div className="border-t border-slate-100 px-8 py-4">
          <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            快捷指令
          </h4>
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((cmd) => (
              <button
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                key={cmd.command}
                onClick={() => handleQuickCommand(cmd.command)}
                type="button"
              >
                「{cmd.command}」
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 px-8 py-4">
          <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            最近语音记录
          </h4>
          <div className="flex max-h-32 flex-col gap-2 overflow-y-auto">
            {voiceHistory.length === 0 ? (
              <p className="text-xs text-slate-400">暂无语音记录</p>
            ) : (
              voiceHistory.map((item) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5" key={item.id}>
                  <p className="text-xs text-slate-700">「{item.text}」</p>
                  <p className="mt-0.5 text-[11px] text-teal-600">{item.result}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
