import { Mic, MicOff, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useVoiceAsrWs } from '../hooks/useVoiceAsrWs'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'

interface ChatInputBarProps {
  accessToken: string | null
  language: string
  onTranscriptReady: (text: string) => void
  isProcessing: boolean
}

export function ChatInputBar({
  accessToken,
  language,
  onTranscriptReady,
  isProcessing,
}: ChatInputBarProps) {
  const [textInput, setTextInput] = useState('')
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

  useEffect(() => {
    return () => {
      stopRecording()
      reset()
    }
  }, [stopRecording, reset])

  useEffect(() => {
    if (asrState.status === 'finished' && asrState.finalText) {
      const text = asrState.finalText
      reset()
      onTranscriptReadyRef.current(text)
    }
  }, [asrState.status, asrState.finalText, reset])

  async function handleStartRecording() {
    if (isProcessing) return
    reset()
    startSession(language)
    await startRecording()
  }

  function handleStopRecording() {
    stopRecording()
    finishSession()
  }

  function handleSendText() {
    if (!textInput.trim() || isProcessing) return
    onTranscriptReadyRef.current(textInput.trim())
    setTextInput('')
  }

  const volumeBars = Array.from({ length: 16 }, () => {
    if (!recorderState.isRecording || recorderState.volume === 0) return 3
    const normalized = Math.min(1, recorderState.volume * 4)
    return Math.round(normalized * 24 + 4)
  })

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {recorderState.isRecording && (
        <div className="mb-3 flex h-8 items-center justify-center gap-0.5">
          {volumeBars.map((height, i) => (
            <div
              className="w-1 rounded-full bg-teal-500 transition-all duration-75"
              key={i}
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
      )}

      {asrState.status === 'finishing' && (
        <div className="mb-3 text-center text-xs text-slate-500">识别中...</div>
      )}

      {isProcessing && !recorderState.isRecording && (
        <div className="mb-3 text-center text-xs text-slate-500">处理中...</div>
      )}

      <div className="flex items-center gap-3">
        <button
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all ${
            recorderState.isRecording
              ? 'animate-pulse bg-rose-500 text-white'
              : 'bg-slate-900 text-white hover:bg-teal-700'
          } ${isProcessing ? 'cursor-not-allowed opacity-50' : ''}`}
          onMouseDown={() => {
            if (!isProcessing) void handleStartRecording()
          }}
          onMouseUp={() => {
            if (recorderState.isRecording) handleStopRecording()
          }}
          onTouchStart={() => {
            if (!isProcessing) void handleStartRecording()
          }}
          onTouchEnd={() => {
            if (recorderState.isRecording) handleStopRecording()
          }}
          type="button"
        >
          {recorderState.isRecording ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
          <input
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendText()
              }
            }}
            placeholder="输入消息或按住麦克风说话..."
            type="text"
            value={textInput}
          />
          <button
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              textInput.trim() && !isProcessing
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'text-slate-300'
            }`}
            disabled={!textInput.trim() || isProcessing}
            onClick={handleSendText}
            type="button"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {recorderState.error && (
        <p className="mt-2 text-center text-xs text-rose-500">{recorderState.error}</p>
      )}
      {asrState.error && !recorderState.error && (
        <p className="mt-2 text-center text-xs text-rose-500">{asrState.error}</p>
      )}
    </div>
  )
}
