import { Mic, MicOff, Volume2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { quickCommands, voiceHistory } from '../data/mock'

export function VoiceModal({ onClose }: { onClose: () => void }) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'confirm' | 'success'>('idle')
  const [volumeBars, setVolumeBars] = useState<number[]>(Array.from({ length: 20 }, () => 3))
  const [confirmationText, setConfirmationText] = useState('')

  // Simulate volume animation when recording
  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      setVolumeBars(
        Array.from({ length: 20 }, () => Math.random() * 28 + 4),
      )
    }, 80)

    return () => clearInterval(interval)
  }, [isRecording])

  // Simulate voice input flow
  useEffect(() => {
    if (status === 'listening') {
      const timer = setTimeout(() => {
        setTranscript('明天下午三点和张总在国贸喝咖啡，提前半小时提醒我')
        setStatus('processing')
      }, 2500)
      return () => clearTimeout(timer)
    }

    if (status === 'processing') {
      const timer = setTimeout(() => {
        setConfirmationText(
          '已理解：明天下午 3 点在国贸和张总喝咖啡，提前 30 分钟提醒，对吗？',
        )
        setStatus('confirm')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status])

  function startRecording() {
    setIsRecording(true)
    setStatus('listening')
    setTranscript('')
    setConfirmationText('')
  }

  function stopRecording() {
    setIsRecording(false)
    if (status === 'listening') {
      setTranscript('明天下午三点和张总在国贸喝咖啡，提前半小时提醒我')
      setStatus('processing')
    }
  }

  function confirmAction() {
    setStatus('success')
    setConfirmationText('')
    setTimeout(() => {
      setStatus('idle')
      setTranscript('')
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="px-8 pt-8 pb-6">
          {/* Status */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">
              {status === 'idle' && '按住说话'}
              {status === 'listening' && '正在聆听...'}
              {status === 'processing' && '正在解析...'}
              {status === 'confirm' && '请确认'}
              {status === 'success' && '已添加！'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {status === 'idle' && '说出您的日程安排'}
              {status === 'listening' && '请描述您的事件'}
              {status === 'processing' && '识别中，请稍候'}
              {status === 'confirm' && '确认信息是否正确'}
              {status === 'success' && '事件已成功创建'}
            </p>
          </div>

          {/* Volume waveform */}
          {isRecording && (
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

          {/* Transcript display */}
          {transcript && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700 leading-relaxed">{transcript}</p>
            </div>
          )}

          {/* Confirmation */}
          {confirmationText && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-start gap-2">
                <Volume2 size={16} className="mt-0.5 shrink-0 text-teal-600" />
                <p className="text-sm text-teal-800 leading-relaxed">
                  {confirmationText}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
                  onClick={confirmAction}
                  type="button"
                >
                  对的，确认
                </button>
                <button
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setStatus('idle')
                    setTranscript('')
                    setConfirmationText('')
                  }}
                  type="button"
                >
                  不对，重说
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
              <p className="text-sm font-medium text-teal-800">
                已为您创建明天下午 3 点的「和张总在国贸喝咖啡」
              </p>
            </div>
          )}

          {/* Mic button */}
          <div className="mt-6 flex justify-center">
            <button
              className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all ${
                isRecording
                  ? 'bg-rose-500 text-white shadow-rose-200 animate-pulse'
                  : status === 'success'
                    ? 'bg-teal-500 text-white shadow-teal-200'
                    : 'bg-slate-900 text-white shadow-slate-300 hover:bg-teal-700 hover:scale-105'
              }`}
              onMouseDown={() => {
                if (status === 'idle' || status === 'success') startRecording()
              }}
              onMouseUp={() => {
                if (isRecording) stopRecording()
              }}
              onTouchStart={() => {
                if (status === 'idle' || status === 'success') startRecording()
              }}
              onTouchEnd={() => {
                if (isRecording) stopRecording()
              }}
              type="button"
            >
              {isRecording ? (
                <MicOff size={32} />
              ) : status === 'success' ? (
                <Volume2 size={28} />
              ) : (
                <Mic size={32} />
              )}
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            {isRecording ? '松开结束录音' : '按住麦克风按钮开始说话'}
          </p>
        </div>

        {/* Quick commands */}
        <div className="border-t border-slate-100 px-8 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            快捷指令
          </h4>
          <div className="flex flex-wrap gap-2">
            {quickCommands.map((cmd) => (
              <button
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                key={cmd.command}
                onClick={() => {
                  setTranscript(cmd.command)
                  setStatus('processing')
                  setTimeout(() => {
                    setConfirmationText(`执行：${cmd.action}，确认吗？`)
                    setStatus('confirm')
                  }, 1500)
                }}
                type="button"
              >
                「{cmd.command}」
              </button>
            ))}
          </div>
        </div>

        {/* Voice history */}
        <div className="border-t border-slate-100 px-8 py-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            最近语音记录
          </h4>
          <div className="flex max-h-32 flex-col gap-2 overflow-y-auto">
            {voiceHistory.map((item) => (
              <div
                className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                key={item.id}
              >
                <p className="text-xs text-slate-700">「{item.text}」</p>
                <p className="mt-0.5 text-[11px] text-teal-600">{item.result}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
