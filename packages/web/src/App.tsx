import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  MapPin,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Tag,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

import type { CalendarViewType } from './components/CalendarViews'
import {
  CalendarContainer,
  CalendarViewSwitcher,
  DateNavigator,
  navigateDate,
} from './components/CalendarViews'
import { CreateEventModal, EventModal } from './components/EventModal'
import { TagFilterBar } from './components/TagFilterBar'
import { TagManager } from './components/TagManager'
import { VoiceModal } from './components/VoiceModal'
import { getEventsForDate, mockEvents, mockNotifications, mockUser } from './data/mock'
import type { Event, Reminder } from './data/mock'
import { getAllTagNames } from './lib/tags'

type Page = 'calendar' | 'voice' | 'settings'

function getTodayStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// ─── Notification Panel ───

function NotificationPanel({
  notifications,
  onClose,
}: {
  notifications: typeof mockNotifications
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="absolute top-14 right-4 z-40 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-900">通知</h3>
        <button
          aria-label="关闭"
          className="text-slate-400 transition hover:text-slate-600"
          onClick={onClose}
          type="button"
        >
          <X size={16} />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">暂无通知</div>
        ) : (
          notifications.map((n) => (
            <div className="border-b border-slate-50 px-4 py-3 last:border-b-0" key={n.id}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatTime(n.time)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Mini Calendar Sidebar ───

function MiniCalendar({
  currentDate,
  events,
  onSelectDate,
}: {
  currentDate: Date
  events: Event[]
  onSelectDate: (date: Date) => void
}) {
  const [displayMonth, setDisplayMonth] = useState(() => {
    const d = new Date(currentDate)
    d.setDate(1)
    return d
  })

  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()

  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }
  // Next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          aria-label="上一月"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100"
          onClick={() => setDisplayMonth(new Date(year, month - 1, 1))}
          type="button"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {year}年{month + 1}月
        </span>
        <button
          aria-label="下一月"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100"
          onClick={() => setDisplayMonth(new Date(year, month + 1, 1))}
          type="button"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((d) => (
          <div className="py-1 text-center text-[10px] font-medium text-slate-400" key={d}>
            {d}
          </div>
        ))}
        {days.map(({ date, isCurrentMonth }, i) => {
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
          const isSelected =
            date.getDate() === currentDate.getDate() &&
            date.getMonth() === currentDate.getMonth() &&
            date.getFullYear() === currentDate.getFullYear()
          const hasEvents = getEventsForDate(events, date).length > 0

          return (
            <button
              className={`flex h-7 flex-col items-center justify-center rounded text-xs transition ${
                isSelected
                  ? 'bg-slate-900 text-white'
                  : isToday
                    ? 'bg-teal-100 text-teal-800'
                    : isCurrentMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300'
              }`}
              key={i}
              onClick={() => onSelectDate(new Date(date))}
              type="button"
            >
              <span>{date.getDate()}</span>
              {hasEvents && !isSelected && (
                <span
                  className={`h-1 w-1 rounded-full ${isToday ? 'bg-teal-500' : 'bg-teal-400'}`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upcoming Events Sidebar ───

function UpcomingEvents({
  events,
  onEventClick,
}: {
  events: Event[]
  onEventClick: (e: Event) => void
}) {
  const upcoming = events
    .filter((e) => e.startTime >= new Date())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
        即将到来
      </h4>
      <div className="flex flex-col gap-2">
        {upcoming.map((event) => (
          <button
            className="flex items-start gap-2 rounded-lg p-2 text-left transition hover:bg-slate-50"
            key={event.id}
            onClick={() => onEventClick(event)}
            type="button"
          >
            <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-50 text-[10px] font-semibold text-teal-700">
              <span>{event.startTime.getDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">{event.title}</p>
              <p className="text-[10px] text-slate-500">
                {formatTime(event.startTime)}
                {event.location ? ` · ${event.location}` : ''}
              </p>
            </div>
          </button>
        ))}
        {upcoming.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-400">暂无事件</p>
        )}
      </div>
    </div>
  )
}

// ─── Settings Page ───

function SettingsPage({
  events,
  hiddenTags,
  onRenameTag,
  onDeleteTag,
}: {
  events: Event[]
  hiddenTags: Set<string>
  onRenameTag: (from: string, to: string) => void
  onDeleteTag: (tag: string) => void
}) {
  const [settings, setSettings] = useState(mockUser.settings)
  const [activeTab, setActiveTab] = useState<'general' | 'voice' | 'tags' | 'account'>('general')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">设置</h2>
        <p className="mt-1 text-sm text-slate-500">管理您的账户和应用偏好</p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-48 shrink-0 space-y-1">
          {[
            { id: 'general' as const, label: '通用', icon: Settings },
            { id: 'voice' as const, label: '语音', icon: Volume2 },
            { id: 'tags' as const, label: '标签', icon: Tag },
            { id: 'account' as const, label: '账户', icon: Users },
          ].map((tab) => (
            <button
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">通用设置</h3>
                <p className="text-sm text-slate-500">自定义日历的外观和行为</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">主题</p>
                    <p className="text-xs text-slate-500">选择应用主题</p>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { value: 'light' as const, icon: Sun, label: '浅色' },
                      { value: 'dark' as const, icon: Moon, label: '深色' },
                      { value: 'system' as const, icon: Settings, label: '跟随系统' },
                    ].map((opt) => (
                      <button
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          settings.theme === opt.value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        key={opt.value}
                        onClick={() => setSettings((s) => ({ ...s, theme: opt.value }))}
                        type="button"
                      >
                        <opt.icon size={14} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">默认视图</p>
                    <p className="text-xs text-slate-500">打开日历时默认显示的视图</p>
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        defaultView: e.target.value as typeof settings.defaultView,
                      }))
                    }
                    value={settings.defaultView}
                  >
                    <option value="day">日视图</option>
                    <option value="week">周视图</option>
                    <option value="month">月视图</option>
                    <option value="list">列表视图</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">默认提醒时间</p>
                    <p className="text-xs text-slate-500">新事件的默认提醒提前量</p>
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        defaultReminderMinutes: Number(e.target.value),
                      }))
                    }
                    value={settings.defaultReminderMinutes}
                  >
                    <option value={0}>准时</option>
                    <option value={5}>提前 5 分钟</option>
                    <option value={10}>提前 10 分钟</option>
                    <option value={15}>提前 15 分钟</option>
                    <option value={30}>提前 30 分钟</option>
                    <option value={60}>提前 1 小时</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">语音设置</h3>
                <p className="text-sm text-slate-500">配置语音识别和反馈选项</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">语音反馈</p>
                    <p className="text-xs text-slate-500">操作完成后语音播报结果</p>
                  </div>
                  <button
                    className={`relative h-6 w-11 rounded-full transition ${
                      settings.voiceFeedback ? 'bg-teal-500' : 'bg-slate-300'
                    }`}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        voiceFeedback: !s.voiceFeedback,
                      }))
                    }
                    type="button"
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        settings.voiceFeedback ? 'translate-x-5.5' : 'translate-x-0.5'
                      }`}
                      style={{
                        transform: settings.voiceFeedback ? 'translateX(22px)' : 'translateX(2px)',
                      }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">语音语速</p>
                    <p className="text-xs text-slate-500">调整语音播报速度</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">慢</span>
                    <input
                      className="w-32 accent-teal-600"
                      max={2}
                      min={0.5}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          voiceSpeed: Number(e.target.value),
                        }))
                      }
                      step={0.1}
                      type="range"
                      value={settings.voiceSpeed}
                    />
                    <span className="text-xs text-slate-400">快</span>
                    <span className="w-8 text-right text-xs font-medium text-slate-700">
                      {settings.voiceSpeed}x
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">语音识别语言</p>
                    <p className="text-xs text-slate-500">选择语音输入的识别语言</p>
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                    value={settings.language}
                  >
                    <option value="zh-CN">中文（普通话）</option>
                    <option value="en-US">English (US)</option>
                    <option value="zh-TW">中文（台湾）</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tags' && (
            <TagManager
              events={events}
              hiddenTags={hiddenTags}
              onDelete={onDeleteTag}
              onRename={onRenameTag}
            />
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">账户信息</h3>
                <p className="text-sm text-slate-500">管理您的个人资料和账户</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-xl font-bold text-teal-700">
                  {mockUser.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{mockUser.name}</p>
                  <p className="text-sm text-slate-500">{mockUser.email}</p>
                  <p className="mt-1 text-xs text-slate-400">时区：{mockUser.timezone}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">显示名称</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={mockUser.name}
                    type="text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">邮箱</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    defaultValue={mockUser.email}
                    type="email"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">数据导出</p>
                  <p className="text-xs text-slate-500">导出日历事件为 ICS / CSV 格式</p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  type="button"
                >
                  导出数据
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50 p-4">
                <div>
                  <p className="text-sm font-medium text-rose-700">删除账户</p>
                  <p className="text-xs text-rose-500">此操作不可撤销</p>
                </div>
                <button
                  className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  type="button"
                >
                  删除账户
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Voice Assistant Page ───

function VoicePage() {
  const [showVoiceModal, setShowVoiceModal] = useState(false)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-50">
          <Mic size={36} className="text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">语音助手</h2>
        <p className="mt-2 text-slate-500">用自然语言快速创建、查询和修改日程</p>
      </div>

      <button
        className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-300 transition hover:scale-105 hover:bg-teal-700"
        onClick={() => setShowVoiceModal(true)}
        type="button"
      >
        <Mic size={40} />
      </button>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">您可以这样说</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            '明天下午三点和张总在国贸喝咖啡',
            '每周一三五晚上 8 点提醒我去健身',
            '把我刚才加的会议删掉',
            '下周我要出差吗？',
            '会议延期 15 分钟',
            '今天有什么安排？',
          ].map((example) => (
            <div
              className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600"
              key={example}
            >
              「{example}」
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">快捷指令</h3>
        <div className="flex flex-wrap gap-2">
          {['我到家了', '会议延期 15 分钟', '会议取消', '今天有什么安排', '下周日程'].map((cmd) => (
            <span
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
              key={cmd}
            >
              {cmd}
            </span>
          ))}
        </div>
      </div>

      {showVoiceModal && <VoiceModal onClose={() => setShowVoiceModal(false)} />}
    </div>
  )
}

// ─── Main App ───

const SIDEBAR_DEFAULT_WIDTH = 240
const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 480
const SIDEBAR_WIDTH_STORAGE_KEY = 'vocalendar:sidebarWidth'
const HIDDEN_TAGS_STORAGE_KEY = 'vocalendar:hiddenTags'

function loadHiddenTags(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(HIDDEN_TAGS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function App() {
  const [page, setPage] = useState<Page>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week')
  const [currentDate, setCurrentDate] = useState(() => getTodayStart())
  const [events, setEvents] = useState<Event[]>(mockEvents)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    const parsed = stored ? Number.parseInt(stored, 10) : SIDEBAR_DEFAULT_WIDTH
    if (Number.isNaN(parsed)) return SIDEBAR_DEFAULT_WIDTH
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed))
  })
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(() => loadHiddenTags())

  const selectedEvent = selectedEventId
    ? (events.find((e) => e.id === selectedEventId) ?? null)
    : null

  const tagSuggestions = useMemo(() => getAllTagNames(events), [events])

  // Sanitize hiddenTags against the live tag set: drop entries that no longer
  // correspond to any event (after rename / delete / mock reload).
  const sanitizedHiddenTags = useMemo(() => {
    const live = new Set(tagSuggestions)
    const next = new Set<string>()
    for (const t of hiddenTags) if (live.has(t)) next.add(t)
    return next
  }, [hiddenTags, tagSuggestions])

  const visibleEvents = useMemo(() => {
    if (sanitizedHiddenTags.size === 0) return events
    return events.filter((e) => {
      if (!e.tags || e.tags.length === 0) return true
      return e.tags.some((t) => !sanitizedHiddenTags.has(t))
    })
  }, [events, sanitizedHiddenTags])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        HIDDEN_TAGS_STORAGE_KEY,
        JSON.stringify(Array.from(sanitizedHiddenTags)),
      )
    } catch {
      // ignore
    }
  }, [sanitizedHiddenTags])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
    } catch {
      // ignore quota / privacy errors
    }
  }, [sidebarWidth])

  const hasUnreadNotif = notifications.some((n) => !n.read)

  function handleNavigate(direction: 'prev' | 'next') {
    setCurrentDate((d) => navigateDate(d, calendarView, direction))
  }

  function handleToday() {
    setCurrentDate(getTodayStart())
  }

  function handleEventClick(event: Event) {
    setSelectedEventId(event.id)
  }

  function navigateToPage(p: Page) {
    setPage(p)
    setIsMobileNavOpen(false)
  }

  function createEvent(input: {
    title: string
    description?: string
    startTime: Date
    endTime?: Date
    location?: string
    priority: 'low' | 'normal' | 'high'
    allDay?: boolean
    tags?: string[]
  }) {
    const now = new Date()
    const id = `event-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const reminders: Reminder[] = [
      { id: `${id}-r1`, eventId: id, minutesBefore: 15, method: 'push' },
    ]
    const newEvent: Event = {
      id,
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      allDay: input.allDay,
      timezone: 'Asia/Shanghai',
      location: input.location,
      reminders,
      priority: input.priority,
      tags: input.tags,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    }
    setEvents((arr) => [...arr, newEvent])
  }

  function updateEvent(id: string, patch: Partial<Event>) {
    setEvents((arr) =>
      arr.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date() } : e)),
    )
  }

  function deleteEvent(id: string) {
    setEvents((arr) => arr.filter((e) => e.id !== id))
    setSelectedEventId((cur) => (cur === id ? null : cur))
  }

  function toggleTagVisibility(tag: string) {
    setHiddenTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  function clearTagFilter() {
    setHiddenTags(new Set())
  }

  function focusOnTag(tag: string) {
    // "Focus this tag" — hide every other tag. Untagged events stay visible
    // per product decision.
    setHiddenTags(new Set(tagSuggestions.filter((t) => t !== tag)))
  }

  function renameTag(from: string, to: string) {
    const target = to.trim()
    if (!target || target === from) return
    setEvents((arr) =>
      arr.map((e) => {
        if (!e.tags) return e
        if (!e.tags.includes(from)) return e
        const next = Array.from(new Set(e.tags.map((t) => (t === from ? target : t))))
        return { ...e, tags: next, updatedAt: new Date() }
      }),
    )
    setHiddenTags((prev) => {
      const next = new Set(prev)
      const wasHidden = next.delete(from)
      if (wasHidden) next.add(target)
      return next
    })
  }

  function deleteTag(tag: string) {
    setEvents((arr) =>
      arr.map((e) => {
        if (!e.tags || !e.tags.includes(tag)) return e
        const filtered = e.tags.filter((t) => t !== tag)
        return {
          ...e,
          tags: filtered.length > 0 ? filtered : undefined,
          updatedAt: new Date(),
        }
      }),
    )
    setHiddenTags((prev) => {
      if (!prev.has(tag)) return prev
      const next = new Set(prev)
      next.delete(tag)
      return next
    })
  }

  function toggleNotifPanel() {
    setShowNotifPanel((prev) => {
      const next = !prev
      if (next && hasUnreadNotif) {
        setNotifications((arr) => arr.map((n) => ({ ...n, read: true })))
      }
      return next
    })
  }

  function startSidebarResize(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    setIsResizingSidebar(true)

    function onMove(ev: MouseEvent) {
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth + ev.clientX - startX),
      )
      setSidebarWidth(next)
    }

    function onUp() {
      setIsResizingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function resetSidebarWidth() {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
  }

  return (
    <div className="flex h-screen bg-[#f6f7f9]">
      {/* Mobile sidebar backdrop */}
      {isMobileNavOpen && (
        <button
          aria-label="关闭菜单"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setIsMobileNavOpen(false)}
          type="button"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobileNavOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden md:flex'
        } shrink-0 flex-col border-r border-slate-200 bg-white md:relative`}
        style={{ width: isMobileNavOpen ? SIDEBAR_DEFAULT_WIDTH : sidebarWidth }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <CalendarDays size={18} />
          </div>
          <span className="text-lg font-bold text-slate-900">Vocalendar</span>
        </div>

        {/* Create button */}
        <div className="px-3 pb-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            onClick={() => setShowCreateModal(true)}
            type="button"
          >
            <Plus size={18} />
            创建事件
          </button>
        </div>

        {/* Nav */}
        <nav className="space-y-1.5 px-3">
          {[
            { id: 'calendar' as Page, label: '日历', icon: CalendarDays },
            { id: 'voice' as Page, label: '语音助手', icon: Mic },
            { id: 'settings' as Page, label: '设置', icon: Settings },
          ].map((item) => (
            <button
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                page === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              key={item.id}
              onClick={() => navigateToPage(item.id)}
              type="button"
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mini Calendar - only show on calendar page */}
        {page === 'calendar' && (
          <div className="space-y-3 px-3 pb-3">
            <MiniCalendar
              currentDate={currentDate}
              events={visibleEvents}
              onSelectDate={(d) => {
                setCurrentDate(d)
                setCalendarView('day')
              }}
            />
            <UpcomingEvents events={visibleEvents} onEventClick={handleEventClick} />
          </div>
        )}

        {/* User */}
        <div className="mt-auto border-t border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
              {mockUser.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{mockUser.name}</p>
              <p className="truncate text-[10px] text-slate-500">{mockUser.email}</p>
            </div>
          </div>
        </div>

        {/* Resize handle (desktop only) */}
        <div
          aria-label="拖动以调整侧边栏宽度，双击恢复默认"
          aria-orientation="vertical"
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuenow={sidebarWidth}
          className={`absolute top-0 right-0 hidden h-full w-1.5 cursor-col-resize transition-colors md:block ${
            isResizingSidebar ? 'bg-teal-400' : 'bg-transparent hover:bg-teal-200'
          }`}
          onDoubleClick={resetSidebarWidth}
          onMouseDown={startSidebarResize}
          role="separator"
          tabIndex={-1}
        />
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        {page === 'calendar' && (
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                aria-label="打开菜单"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
                onClick={() => setIsMobileNavOpen(true)}
                type="button"
              >
                <Menu size={18} />
              </button>
              <DateNavigator
                date={currentDate}
                onNavigate={handleNavigate}
                onToday={handleToday}
                view={calendarView}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CalendarViewSwitcher onChange={setCalendarView} view={calendarView} />
              <button
                aria-label={hasUnreadNotif ? '通知（有未读）' : '通知'}
                className="relative ml-2 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                onClick={toggleNotifPanel}
                type="button"
              >
                <Bell size={18} />
                {hasUnreadNotif && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>
              <button
                aria-label="语音助手"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                onClick={() => setShowVoiceModal(true)}
                type="button"
              >
                <Mic size={18} />
              </button>
            </div>
          </header>
        )}

        {page !== 'calendar' && (
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex items-center gap-2">
              <button
                aria-label="打开菜单"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
                onClick={() => setIsMobileNavOpen(true)}
                type="button"
              >
                <Menu size={18} />
              </button>
              <h1 className="text-xl font-bold text-slate-900">
                {page === 'voice' && '语音助手'}
                {page === 'settings' && '设置'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="语音助手"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                onClick={() => setShowVoiceModal(true)}
                type="button"
              >
                <Mic size={18} />
              </button>
            </div>
          </header>
        )}

        {page === 'calendar' && (
          <TagFilterBar
            allTags={tagSuggestions}
            hiddenTags={sanitizedHiddenTags}
            onClear={clearTagFilter}
            onFocus={focusOnTag}
            onToggle={toggleTagVisibility}
          />
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {page === 'calendar' && (
            <div className="h-full p-4">
              <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <CalendarContainer
                  currentDate={currentDate}
                  events={visibleEvents}
                  onEventClick={handleEventClick}
                  view={calendarView}
                />
              </div>
            </div>
          )}

          {page === 'voice' && (
            <div className="h-full overflow-y-auto p-6">
              <VoicePage />
            </div>
          )}

          {page === 'settings' && (
            <div className="h-full overflow-y-auto p-6">
              <SettingsPage
                events={events}
                hiddenTags={sanitizedHiddenTags}
                onDeleteTag={deleteTag}
                onRenameTag={renameTag}
              />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onDelete={() => deleteEvent(selectedEvent.id)}
          onTagClick={focusOnTag}
          onUpdate={(patch) => updateEvent(selectedEvent.id, patch)}
          tagSuggestions={tagSuggestions}
        />
      )}

      {showCreateModal && (
        <CreateEventModal
          initialDate={currentDate}
          onClose={() => setShowCreateModal(false)}
          onCreate={(input) => {
            createEvent(input)
            setShowCreateModal(false)
          }}
          tagSuggestions={tagSuggestions}
        />
      )}

      {showVoiceModal && <VoiceModal onClose={() => setShowVoiceModal(false)} />}

      {showNotifPanel && (
        <NotificationPanel notifications={notifications} onClose={() => setShowNotifPanel(false)} />
      )}
    </div>
  )
}

export default App
