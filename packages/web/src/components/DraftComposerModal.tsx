import { LoaderCircle, MessageSquareText, WandSparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { V1EventDraftRecord } from '../lib/api-types'

interface DraftComposerModalProps {
  isSubmitting: boolean
  errorMessage: string | null
  onClose: () => void
  onSubmit: (input: {
    sourceText?: string
    draftId?: string
    userInput?: string
  }) => Promise<V1EventDraftRecord | null>
}

export function DraftComposerModal({
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: DraftComposerModalProps) {
  const [draft, setDraft] = useState<V1EventDraftRecord | null>(null)
  const [sourceText, setSourceText] = useState('')
  const [clarification, setClarification] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onClose])

  const canCreate = sourceText.trim().length > 0
  const canClarify = clarification.trim().length > 0

  async function handleCreate() {
    if (!canCreate || isSubmitting) return

    const result = await onSubmit({
      sourceText: sourceText.trim(),
    })

    if (result && typeof result === 'object' && 'draftId' in result) {
      setDraft(result as V1EventDraftRecord)
    }
  }

  async function handleClarify() {
    if (!draft || !canClarify || isSubmitting) return

    const result = await onSubmit({
      draftId: draft.draftId,
      userInput: clarification.trim(),
    })

    if (result && typeof result === 'object' && 'draftId' in result) {
      setDraft(result as V1EventDraftRecord)
      setClarification('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">文本草稿创建事件</h3>
            <p className="mt-1 text-sm text-slate-500">先生成草稿，再按后端补问完成确认。</p>
          </div>
          <button
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText size={16} className="text-teal-700" />
              <h4 className="text-sm font-semibold text-slate-900">1. 输入自然语言</h4>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="例如：明天下午三点和张总在国贸喝咖啡，提前半小时提醒我"
              rows={4}
              value={sourceText}
            />
            <div className="mt-3 flex justify-end">
              <button
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:bg-slate-300"
                disabled={!canCreate || isSubmitting}
                onClick={() => void handleCreate()}
                type="button"
              >
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <WandSparkles size={16} />
                )}
                生成草稿
              </button>
            </div>
          </div>

          {draft ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">2. 草稿解析结果</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <DraftField label="标题" value={draft.parsed.title ?? '待补充'} />
                <DraftField label="开始时间" value={draft.parsed.startAt ?? '待补充'} />
                <DraftField label="结束时间" value={draft.parsed.endAt ?? '未识别'} />
                <DraftField label="地点" value={draft.parsed.location ?? '未识别'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.missingFields.length > 0 ? (
                  draft.missingFields.map((field) => (
                    <span
                      className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                      key={field}
                    >
                      缺少 {field}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                    草稿已可确认保存
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {draft && !draft.canSave ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">3. 回答补问</h4>
              <p className="mb-3 text-sm text-slate-600">
                {draft.clarificationPrompt ?? '请补充缺失信息。'}
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setClarification(event.target.value)}
                placeholder="例如：下午三点开始，标题是客户会议"
                rows={3}
                value={clarification}
              />
              <div className="mt-3 flex justify-end">
                <button
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:bg-slate-300"
                  disabled={!canClarify || isSubmitting}
                  onClick={() => void handleClarify()}
                  type="button"
                >
                  {isSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : null}
                  更新草稿
                </button>
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DraftField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  )
}
