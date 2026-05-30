import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { ApiClientError, createDraft, getApiBaseUrl } from './lib/api'
import type { EventDraft } from './lib/api'

type RequestState = 'idle' | 'submitting' | 'success' | 'error'

type DraftError = {
  code: string
  message: string
  details: unknown
}

const fieldLabels: Record<string, string> = {
  title: '标题',
  startAt: '开始时间',
  timezone: '时区',
}

function App() {
  const [sourceText, setSourceText] = useState('')
  const [timezone, setTimezone] = useState(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  })
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [error, setError] = useState<DraftError | null>(null)
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])
  const canSubmit = sourceText.trim().length > 0 && requestState !== 'submitting'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSourceText = sourceText.trim()

    if (!nextSourceText) {
      return
    }

    setRequestState('submitting')
    setError(null)

    try {
      const nextDraft = await createDraft({
        sourceText: nextSourceText,
        timezone,
        referenceAt: new Date().toISOString(),
      })

      setDraft(nextDraft)
      setRequestState('success')
    } catch (caughtError) {
      setDraft(null)
      setRequestState('error')

      if (caughtError instanceof ApiClientError) {
        setError({
          code: caughtError.code,
          message: caughtError.message,
          details: caughtError.details,
        })
        return
      }

      setError({
        code: 'NETWORK_ERROR',
        message: '无法连接 API 服务。',
        details: null,
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">Vocalendar</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">文本创建</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded border border-slate-200 bg-white px-3 py-1 break-all">
              API {apiBaseUrl}
            </span>
            <span className="rounded border border-slate-200 bg-white px-3 py-1">{timezone}</span>
          </div>
        </header>

        <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <form
            className="flex min-h-[360px] flex-col rounded border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            onSubmit={handleSubmit}
          >
            <label className="text-sm font-medium text-slate-700" htmlFor="sourceText">
              自然语言文本
            </label>
            <textarea
              className="mt-3 min-h-44 flex-1 resize-none rounded border border-slate-300 bg-white px-3 py-3 text-base leading-7 transition outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="sourceText"
              placeholder="明天下午三点和张总在国贸喝咖啡"
              value={sourceText}
              onChange={(event) => setSourceText(event.currentTarget.value)}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="text-sm font-medium text-slate-700" htmlFor="timezone">
                时区
                <input
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  id="timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.currentTarget.value)}
                />
              </label>
              <button
                className="h-10 rounded bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!canSubmit}
                type="submit"
              >
                {requestState === 'submitting' ? '生成中' : '生成草稿'}
              </button>
            </div>
          </form>

          <DraftPanel draft={draft} error={error} requestState={requestState} timezone={timezone} />
        </section>
      </div>
    </main>
  )
}

type DraftPanelProps = {
  draft: EventDraft | null
  error: DraftError | null
  requestState: RequestState
  timezone: string
}

function DraftPanel({ draft, error, requestState, timezone }: DraftPanelProps) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">草稿</h2>
        <StatusBadge draft={draft} requestState={requestState} />
      </div>

      {error ? <ErrorState error={error} /> : null}
      {!draft && !error ? <EmptyState requestState={requestState} /> : null}
      {draft ? <DraftDetails draft={draft} timezone={draft.parsed.timezone || timezone} /> : null}
    </section>
  )
}

function StatusBadge({
  draft,
  requestState,
}: {
  draft: EventDraft | null
  requestState: RequestState
}) {
  if (requestState === 'submitting') {
    return (
      <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
        请求中
      </span>
    )
  }

  if (draft?.canSave) {
    return (
      <span className="rounded bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
        可保存
      </span>
    )
  }

  if (draft) {
    return (
      <span className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">
        待补充
      </span>
    )
  }

  if (requestState === 'error') {
    return (
      <span className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800">失败</span>
    )
  }

  return (
    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">等待</span>
  )
}

function EmptyState({ requestState }: { requestState: RequestState }) {
  return (
    <div className="mt-4 rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
      {requestState === 'submitting' ? '正在解析文本' : '暂无草稿'}
    </div>
  )
}

function ErrorState({ error }: { error: DraftError }) {
  return (
    <div className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <div className="font-semibold">{error.code}</div>
      <div className="mt-1">{error.message}</div>
      {error.details ? (
        <pre className="mt-3 max-h-32 overflow-auto rounded bg-white p-2 text-xs text-rose-950">
          {JSON.stringify(error.details, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

function DraftDetails({ draft, timezone }: { draft: EventDraft; timezone: string }) {
  const parsedRows = [
    ['标题', draft.parsed.title ?? '未识别'],
    ['开始时间', draft.parsed.startAt ? formatDateTime(draft.parsed.startAt, timezone) : '未识别'],
    ['结束时间', draft.parsed.endAt ? formatDateTime(draft.parsed.endAt, timezone) : '未设置'],
    ['地点', draft.parsed.location ?? '未识别'],
    [
      '参与人',
      draft.parsed.participants.length > 0 ? draft.parsed.participants.join('、') : '未识别',
    ],
  ]

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded border border-slate-200">
        {parsedRows.map(([label, value]) => (
          <div
            className="grid grid-cols-[96px_minmax(0,1fr)] border-b border-slate-200 last:border-b-0"
            key={label}
          >
            <div className="bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600">{label}</div>
            <div className="min-w-0 px-3 py-3 text-sm break-words text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      <FieldGroup
        emptyLabel="无缺失字段"
        items={draft.missingFields.map((field) => fieldLabels[field] ?? field)}
        title="缺失字段"
        tone="rose"
      />
      <FieldGroup emptyLabel="无警告" items={draft.warnings} title="警告" tone="amber" />

      {draft.clarificationPrompt ? (
        <div className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          {draft.clarificationPrompt}
        </div>
      ) : null}
    </div>
  )
}

type FieldGroupProps = {
  title: string
  items: string[]
  emptyLabel: string
  tone: 'rose' | 'amber'
}

function FieldGroup({ title, items, emptyLabel, tone }: FieldGroupProps) {
  const colorClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <span
              className={`rounded border px-2 py-1 text-xs font-medium ${colorClass}`}
              key={item}
            >
              {item}
            </span>
          ))
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
            {emptyLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export default App
