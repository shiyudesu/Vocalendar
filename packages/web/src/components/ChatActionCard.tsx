import type { AssistantAction } from '@vocalendar/schemas'
import { Calendar, MapPin, Users, Check, X, Clock } from 'lucide-react'

interface ChatActionCardProps {
  action: AssistantAction
  onConfirm: (action: AssistantAction) => void
  onCancel: (action: AssistantAction) => void
}

function formatDateTime(isoString: string | null) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function ChatActionCard({ action, onConfirm, onCancel }: ChatActionCardProps) {
  const typeLabel = {
    create: '创建',
    update: '更新',
    delete: '删除',
    query: '查询',
    clarify: '补问',
  }[action.type]

  const typeColor = {
    create: 'bg-teal-100 text-teal-700',
    update: 'bg-amber-100 text-amber-700',
    delete: 'bg-rose-100 text-rose-700',
    query: 'bg-slate-100 text-slate-700',
    clarify: 'bg-blue-100 text-blue-700',
  }[action.type]

  const isExecuted = action.status === 'executed'
  const isCancelled = action.status === 'cancelled'
  const isClarify = action.type === 'clarify'

  return (
    <div className="ml-11 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}>
            {typeLabel}
          </span>
          {isExecuted && (
            <span className="flex items-center gap-1 text-xs text-teal-600">
              <Check size={12} />
              已执行
            </span>
          )}
          {isCancelled && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <X size={12} />
              已取消
            </span>
          )}
        </div>
        {!isExecuted && !isCancelled && !isClarify && (
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700"
              onClick={() => onConfirm(action)}
              type="button"
            >
              <Check size={12} />
              确认
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={() => onCancel(action)}
              type="button"
            >
              <X size={12} />
              放弃
            </button>
          </div>
        )}
      </div>

      {action.eventDraft && (
        <div className="space-y-2 px-4 py-3">
          {action.eventDraft.title ? (
            <div className="flex items-center gap-2 text-sm text-slate-800">
              <Calendar size={14} className="text-slate-400" />
              <span className="font-medium">{action.eventDraft.title}</span>
            </div>
          ) : null}
          {action.eventDraft.startAt ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={14} className="text-slate-400" />
              <span>
                {formatDateTime(action.eventDraft.startAt)}
                {action.eventDraft.endAt ? ` ~ ${formatDateTime(action.eventDraft.endAt)}` : ''}
              </span>
            </div>
          ) : null}
          {action.eventDraft.location ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin size={14} className="text-slate-400" />
              <span>{action.eventDraft.location}</span>
            </div>
          ) : null}
          {action.eventDraft.participants.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users size={14} className="text-slate-400" />
              <span>{action.eventDraft.participants.join('、')}</span>
            </div>
          ) : null}
        </div>
      )}

      {action.type === 'update' && action.changes && (
        <div className="px-4 py-3 text-xs text-slate-500">
          <div className="font-medium text-slate-700">修改内容：</div>
          <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap">
            {JSON.stringify(action.changes, null, 2)}
          </pre>
        </div>
      )}

      {action.type === 'clarify' && action.question && (
        <div className="px-4 py-3 text-sm text-slate-600">{action.question}</div>
      )}
    </div>
  )
}
