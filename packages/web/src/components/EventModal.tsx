import { Bell, Clock, MapPin, Pencil, Repeat, Tag, Trash2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getPriorityColor } from '../data/mock'
import type { Attendee, Event, RecurrenceRule, Reminder } from '../data/mock'
import { TagChip } from './TagChip'
import { TagInput } from './TagInput'

function formatDateTimeInput(date: Date): string {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function formatDateTimeDisplay(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatRecurrence(rule?: RecurrenceRule): string {
  if (!rule) return '不重复'
  const freqMap: Record<string, string> = {
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    yearly: '每年',
  }
  let text = freqMap[rule.frequency] || rule.frequency
  if (rule.interval && rule.interval > 1) {
    text = `每${rule.interval}${rule.frequency === 'daily' ? '天' : rule.frequency === 'weekly' ? '周' : rule.frequency === 'monthly' ? '月' : '年'}`
  }
  if (rule.byWeekDay && rule.byWeekDay.length > 0) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    text += `（${rule.byWeekDay.map((d) => days[d]).join('、')}）`
  }
  if (rule.count) text += `，共${rule.count}次`
  if (rule.until) text += `，截止${formatDateTimeDisplay(rule.until)}`
  return text
}

function formatReminder(reminder: Reminder): string {
  const methodMap: Record<string, string> = {
    push: '应用推送',
    email: '邮件',
    sms: '短信',
  }
  return `${reminder.minutesBefore === 0 ? '准时' : `提前${reminder.minutesBefore}分钟`} · ${methodMap[reminder.method]}`
}

export function EventModal({
  event,
  onClose,
  onUpdate,
  onDelete,
  onTagClick,
  tagSuggestions = [],
}: {
  event: Event
  onClose: () => void
  onUpdate?: (patch: Partial<Event>) => void
  onDelete?: () => void
  onTagClick?: (tag: string) => void
  tagSuggestions?: string[]
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: event.title,
    description: event.description || '',
    startTime: formatDateTimeInput(event.startTime),
    endTime: event.endTime ? formatDateTimeInput(event.endTime) : '',
    location: event.location || '',
    priority: event.priority,
    allDay: event.allDay || false,
    tags: event.tags ?? [],
  })

  function startEditing() {
    setEditForm({
      title: event.title,
      description: event.description || '',
      startTime: formatDateTimeInput(event.startTime),
      endTime: event.endTime ? formatDateTimeInput(event.endTime) : '',
      location: event.location || '',
      priority: event.priority,
      allDay: event.allDay || false,
      tags: event.tags ?? [],
    })
    setIsEditing(true)
  }

  function handleSaveEdit() {
    if (!onUpdate) {
      setIsEditing(false)
      return
    }
    const editEndBeforeStart = Boolean(
      editForm.endTime && editForm.startTime && editForm.endTime < editForm.startTime,
    )
    if (!editForm.title.trim() || editEndBeforeStart) return
    onUpdate({
      title: editForm.title.trim(),
      description: editForm.description.trim() || undefined,
      startTime: new Date(editForm.startTime),
      endTime: editForm.endTime ? new Date(editForm.endTime) : undefined,
      allDay: editForm.allDay,
      location: editForm.location.trim() || undefined,
      priority: editForm.priority,
      tags: editForm.tags.length > 0 ? editForm.tags : undefined,
    })
    setIsEditing(false)
  }

  const editEndBeforeStart = Boolean(
    editForm.endTime && editForm.startTime && editForm.endTime < editForm.startTime,
  )
  const canSaveEdit = Boolean(editForm.title.trim()) && !editEndBeforeStart

  const priorityLabels: Record<string, string> = {
    high: '紧急',
    normal: '普通',
    low: '低优先级',
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isEditing) setIsEditing(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isEditing, onClose])

  if (isEditing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={() => setIsEditing(false)}
      >
        <div
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">编辑事件</h3>
            <button
              aria-label="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">标题</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                type="text"
                value={editForm.title}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">开始时间</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  type="datetime-local"
                  value={editForm.startTime}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">结束时间</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  type="datetime-local"
                  value={editForm.endTime}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                checked={editForm.allDay}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                id="allDay"
                onChange={(e) => setEditForm((f) => ({ ...f, allDay: e.target.checked }))}
                type="checkbox"
              />
              <label className="text-sm text-slate-700" htmlFor="allDay">
                全天事件
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">地点</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="添加地点..."
                type="text"
                value={editForm.location}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">描述</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="添加描述..."
                rows={3}
                value={editForm.description}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-slate-700"
                htmlFor="editEventTags"
              >
                标签
              </label>
              <TagInput
                id="editEventTags"
                onChange={(tags) => setEditForm((f) => ({ ...f, tags }))}
                suggestions={tagSuggestions}
                value={editForm.tags}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">优先级</label>
              <div className="flex gap-2">
                {(['high', 'normal', 'low'] as const).map((p) => (
                  <button
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      editForm.priority === p
                        ? p === 'high'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : p === 'normal'
                            ? 'border-teal-200 bg-teal-50 text-teal-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    key={p}
                    onClick={() => setEditForm((f) => ({ ...f, priority: p }))}
                    type="button"
                  >
                    {priorityLabels[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setIsEditing(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:bg-slate-300"
              disabled={!canSaveEdit}
              onClick={handleSaveEdit}
              type="button"
            >
              保存更改
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`relative px-6 pt-5 pb-4 ${
            event.priority === 'high'
              ? 'bg-rose-50'
              : event.priority === 'normal'
                ? 'bg-teal-50'
                : 'bg-slate-50'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${getPriorityColor(event.priority)}`}
              />
              <h3 className="text-xl font-bold text-slate-900">{event.title}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                aria-label="编辑"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/60 hover:text-slate-700"
                onClick={startEditing}
                type="button"
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label="删除"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/60 hover:text-rose-600"
                onClick={() => {
                  if (!onDelete) return
                  if (window.confirm(`确定要删除事件「${event.title}」吗？此操作无法撤销。`)) {
                    onDelete()
                    onClose()
                  }
                }}
                type="button"
              >
                <Trash2 size={16} />
              </button>
              <button
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/60 hover:text-slate-600"
                onClick={onClose}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          {event.description ? (
            <p className="mt-2 text-sm text-slate-600">{event.description}</p>
          ) : null}
        </div>

        {/* Body */}
        <div className="space-y-1 px-6 py-4">
          {/* Time */}
          <div className="flex items-start gap-3 py-2">
            <Clock size={18} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <div className="text-sm font-medium text-slate-900">
                {event.allDay
                  ? `${formatDateTimeDisplay(event.startTime)}（全天）`
                  : `${formatDateTimeDisplay(event.startTime)}`}
              </div>
              {event.endTime ? (
                <div className="text-sm text-slate-500">
                  结束：{formatDateTimeDisplay(event.endTime)}
                </div>
              ) : null}
              <div className="mt-0.5 text-xs text-slate-400">时区：{event.timezone}</div>
            </div>
          </div>

          {/* Location */}
          {event.location ? (
            <div className="flex items-start gap-3 py-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="text-sm text-slate-700">{event.location}</span>
            </div>
          ) : null}

          {/* Recurrence */}
          {event.recurrence ? (
            <div className="flex items-start gap-3 py-2">
              <Repeat size={18} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="text-sm text-slate-700">{formatRecurrence(event.recurrence)}</span>
            </div>
          ) : null}

          {/* Reminders */}
          {event.reminders.length > 0 ? (
            <div className="flex items-start gap-3 py-2">
              <Bell size={18} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="flex flex-col gap-1">
                {event.reminders.map((r) => (
                  <span className="text-sm text-slate-700" key={r.id}>
                    {formatReminder(r)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 ? (
            <div className="flex items-start gap-3 py-2">
              <Users size={18} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="flex flex-wrap gap-2">
                {event.attendees.map((attendee: Attendee) => (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      attendee.status === 'accepted'
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : attendee.status === 'declined'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                    key={attendee.id}
                  >
                    {attendee.name}
                    {attendee.status === 'pending' && '（待确认）'}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tags */}
          {event.tags && event.tags.length > 0 ? (
            <div className="flex items-start gap-3 py-2">
              <Tag size={18} className="mt-0.5 shrink-0 text-slate-400" />
              <div className="flex flex-wrap gap-1.5">
                {event.tags.map((tag) =>
                  onTagClick ? (
                    <TagChip
                      ariaLabel={`聚焦标签「${tag}」`}
                      clickable
                      key={tag}
                      onClick={(t) => {
                        onTagClick(t)
                        onClose()
                      }}
                      size="md"
                      tag={tag}
                    />
                  ) : (
                    <TagChip key={tag} size="md" tag={tag} />
                  ),
                )}
              </div>
            </div>
          ) : null}

          {/* Source */}
          <div className="flex items-center gap-3 py-2">
            <span className="text-xs text-slate-400">
              来源：{event.source === 'voice' ? '语音创建' : '手动创建'}
            </span>
            <span className="text-xs text-slate-400">
              创建时间：{formatDateTimeDisplay(event.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreateEventModal({
  initialDate,
  onClose,
  onCreate,
  tagSuggestions = [],
}: {
  initialDate?: Date
  onClose: () => void
  onCreate?: (input: {
    title: string
    description?: string
    startTime: Date
    endTime?: Date
    location?: string
    priority: 'low' | 'normal' | 'high'
    allDay?: boolean
    tags?: string[]
  }) => void
  tagSuggestions?: string[]
}) {
  const defaultDate = initialDate || new Date()
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: formatDateTimeInput(defaultDate),
    endTime: '',
    location: '',
    priority: 'normal' as 'low' | 'normal' | 'high',
    allDay: false,
    tags: [] as string[],
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const endBeforeStart = Boolean(form.endTime && form.startTime && form.endTime < form.startTime)
  const canSubmit = Boolean(form.title.trim()) && !endBeforeStart

  function handleSubmit() {
    if (!canSubmit) return
    onCreate?.({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startTime: new Date(form.startTime),
      endTime: form.endTime ? new Date(form.endTime) : undefined,
      location: form.location.trim() || undefined,
      priority: form.priority,
      allDay: form.allDay,
      tags: form.tags.length > 0 ? form.tags : undefined,
    })
    if (!onCreate) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">创建新事件</h3>
          <button
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="newEventTitle"
            >
              标题
            </label>
            <input
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="newEventTitle"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="输入事件标题..."
              type="text"
              value={form.title}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-slate-700"
                htmlFor="newEventStart"
              >
                开始时间
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                id="newEventStart"
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                type="datetime-local"
                value={form.startTime}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-slate-700"
                htmlFor="newEventEnd"
              >
                结束时间
              </label>
              <input
                aria-invalid={endBeforeStart}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  endBeforeStart
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-teal-600 focus:ring-teal-100'
                }`}
                id="newEventEnd"
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                type="datetime-local"
                value={form.endTime}
              />
              {endBeforeStart && (
                <p className="mt-1 text-xs text-rose-600">结束时间不能早于开始时间</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              checked={form.allDay}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              id="newAllDay"
              onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
              type="checkbox"
            />
            <label className="text-sm text-slate-700" htmlFor="newAllDay">
              全天事件
            </label>
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="newEventLocation"
            >
              地点
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="newEventLocation"
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="添加地点..."
              type="text"
              value={form.location}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="newEventDescription"
            >
              描述
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              id="newEventDescription"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="添加描述..."
              rows={3}
              value={form.description}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="newEventTags"
            >
              标签
            </label>
            <TagInput
              id="newEventTags"
              onChange={(tags) => setForm((f) => ({ ...f, tags }))}
              suggestions={tagSuggestions}
              value={form.tags}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">优先级</label>
            <div className="flex gap-2">
              {(
                [
                  { value: 'high' as const, label: '紧急' },
                  { value: 'normal' as const, label: '普通' },
                  { value: 'low' as const, label: '低优先级' },
                ] as const
              ).map((p) => (
                <button
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    form.priority === p.value
                      ? p.value === 'high'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : p.value === 'normal'
                          ? 'border-teal-200 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  key={p.value}
                  onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:bg-slate-300"
            disabled={!canSubmit}
            onClick={handleSubmit}
            type="button"
          >
            创建事件
          </button>
        </div>
      </div>
    </div>
  )
}
