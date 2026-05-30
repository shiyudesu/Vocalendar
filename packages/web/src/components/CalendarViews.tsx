import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  getEventsForDate,
  getEventsForMonth,
  getEventsForWeek,
  getPriorityColor,
  mockEvents,
} from '../data/mock'
import type { Event } from '../data/mock'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const WEEK_DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDateFull(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDateShort(date: Date): string {
  return `${String(date.getMonth() + 1)}/${String(date.getDate())}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

// ─── Event Card ───

function EventCard({
  event,
  compact,
  onClick,
}: {
  event: Event
  compact?: boolean
  onClick?: (event: Event) => void
}) {
  const priorityDot = getPriorityColor(event.priority)

  if (compact) {
    return (
      <button
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition hover:bg-slate-100"
        onClick={() => onClick?.(event)}
        type="button"
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot}`} />
        <span className="truncate font-medium text-slate-800">{event.title}</span>
      </button>
    )
  }

  return (
    <button
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
      onClick={() => onClick?.(event)}
      type="button"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot}`} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-slate-900">{event.title}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {event.allDay
                ? '全天'
                : `${formatTime(event.startTime)}${event.endTime ? ` - ${formatTime(event.endTime)}` : ''}`}
            </span>
            {event.location ? (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {event.location}
              </span>
            ) : null}
            {event.attendees && event.attendees.length > 0 ? (
              <span className="flex items-center gap-1">
                <Users size={12} />
                {event.attendees.length}人
              </span>
            ) : null}
          </div>
          {event.tags && event.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {event.tags.map((tag) => (
                <span
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

// ─── Day View ───

export function DayView({
  date,
  onEventClick,
}: {
  date: Date
  onEventClick: (event: Event) => void
}) {
  const events = useMemo(() => getEventsForDate(date), [date])

  const eventPositions = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    return sorted.map((event) => {
      const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60
      const endHour = event.endTime
        ? event.endTime.getHours() + event.endTime.getMinutes() / 60
        : startHour + 1
      const top = startHour * 64
      const height = Math.max((endHour - startHour) * 64 - 2, 28)
      return { event, top, height }
    })
  }, [events])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">{formatDateFull(date)}</h2>
        <span className="text-sm text-slate-500">{WEEK_DAYS[date.getDay()]}</span>
        {isSameDay(date, new Date()) ? (
          <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
            今天
          </span>
        ) : null}
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="relative min-h-[1536px]">
          {/* Hour grid lines */}
          {HOURS.map((hour) => (
            <div
              className="absolute right-0 left-14 flex items-center border-b border-slate-100"
              key={hour}
              style={{ top: hour * 64, height: 64 }}
            >
              <span className="absolute -top-2.5 left-0 w-12 pr-2 text-right text-xs text-slate-400">
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
          ))}

          {/* Events */}
          {eventPositions.map(({ event, top, height }) => (
            <button
              className="absolute right-2 left-16 cursor-pointer overflow-hidden rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-left text-xs transition hover:bg-teal-100"
              key={event.id}
              onClick={() => onEventClick(event)}
              style={{ top, height }}
              type="button"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${getPriorityColor(event.priority)}`}
                />
                <span className="truncate font-medium text-slate-800">{event.title}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-slate-500">{event.location}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Week View ───

export function WeekView({
  weekStart,
  onEventClick,
}: {
  weekStart: Date
  onEventClick: (event: Event) => void
}) {
  const days = useMemo(() => {
    const result: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      result.push(d)
    }
    return result
  }, [weekStart])

  const allEvents = useMemo(() => getEventsForWeek(weekStart), [weekStart])

  const eventsByDay = useMemo(() => {
    const map: Record<number, Event[]> = {}
    for (let i = 0; i < 7; i++) map[i] = []
    for (const event of allEvents) {
      for (let i = 0; i < 7; i++) {
        if (isSameDay(event.startTime, days[i])) {
          map[i].push(event)
          break
        }
      }
    }
    for (let i = 0; i < 7; i++) {
      map[i].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    }
    return map
  }, [allEvents, days])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
        <div className="border-r border-slate-100" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date())
          return (
            <div
              className={`px-1 py-2 text-center ${i < 6 ? 'border-r border-slate-100' : ''}`}
              key={i}
            >
              <div className="text-xs text-slate-500">{WEEK_DAYS_SHORT[i]}</div>
              <div
                className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-teal-600 text-white' : 'text-slate-900'
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid min-h-[1536px] grid-cols-[60px_repeat(7,1fr)]">
          {/* Time labels */}
          <div className="border-r border-slate-100">
            {HOURS.map((hour) => (
              <div className="flex items-start justify-end pr-2" key={hour} style={{ height: 64 }}>
                <span className="text-[11px] text-slate-400">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayEvents = eventsByDay[dayIndex]
            const eventPositions = dayEvents.map((event) => {
              const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60
              const endHour = event.endTime
                ? event.endTime.getHours() + event.endTime.getMinutes() / 60
                : startHour + 1
              const top = startHour * 64
              const height = Math.max((endHour - startHour) * 64 - 2, 28)
              return { event, top, height }
            })

            return (
              <div
                className={`relative ${dayIndex < 6 ? 'border-r border-slate-100' : ''}`}
                key={dayIndex}
              >
                {/* Hour lines */}
                {HOURS.map((hour) => (
                  <div className="border-b border-slate-50" key={hour} style={{ height: 64 }} />
                ))}

                {/* Events */}
                {eventPositions.map(({ event, top, height }) => (
                  <button
                    className="absolute right-0.5 left-0.5 cursor-pointer overflow-hidden rounded border border-teal-200 bg-teal-50 px-1 py-0.5 text-left transition hover:bg-teal-100"
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    style={{ top, height }}
                    type="button"
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-1 w-1 shrink-0 rounded-full ${getPriorityColor(event.priority)}`}
                      />
                      <span className="truncate text-[11px] font-medium text-slate-800">
                        {event.title}
                      </span>
                    </div>
                    <div className="truncate text-[9px] text-slate-500">
                      {formatTime(event.startTime)}
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Month View ───

export function MonthView({
  year,
  month,
  onEventClick,
}: {
  year: number
  month: number
  onEventClick: (event: Event) => void
}) {
  const gridDays = useMemo(() => getMonthGrid(year, month), [year, month])
  const monthEvents = useMemo(() => getEventsForMonth(year, month), [year, month])

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {}
    for (const event of monthEvents) {
      const key = `${event.startTime.getFullYear()}-${event.startTime.getMonth()}-${event.startTime.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(event)
    }
    for (const key in map) {
      map[key].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    }
    return map
  }, [monthEvents])

  return (
    <div className="flex h-full flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEK_DAYS_SHORT.map((day) => (
          <div className="py-2 text-center text-xs font-medium text-slate-500" key={day}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {gridDays.map((day, index) => {
          const isCurrentMonth = day.getMonth() === month
          const isToday = isSameDay(day, new Date())
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
          const dayEvents = eventsByDay[key] || []

          return (
            <div
              className={`flex flex-col border-r border-b border-slate-100 p-1.5 ${
                !isCurrentMonth ? 'bg-slate-50/50' : ''
              } ${index % 7 === 6 ? 'border-r-0' : ''}`}
              key={index}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? 'bg-teal-600 text-white'
                      : isCurrentMonth
                        ? 'text-slate-900'
                        : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="text-[10px] text-slate-400">{dayEvents.length}个</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    className="flex items-center gap-1 rounded px-1 py-0.5 text-left transition hover:bg-slate-100"
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    type="button"
                  >
                    <span
                      className={`h-1 w-1 shrink-0 rounded-full ${getPriorityColor(event.priority)}`}
                    />
                    <span className="truncate text-[11px] text-slate-700">
                      {event.allDay ? '' : `${formatTime(event.startTime)} `}
                      {event.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="px-1 text-[10px] text-slate-400">
                    +{dayEvents.length - 3} 更多
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── List View ───

export function ListView({ onEventClick }: { onEventClick: (event: Event) => void }) {
  const sortedEvents = useMemo(() => {
    return [...mockEvents].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  }, [])

  const groupedEvents = useMemo(() => {
    const groups: Record<string, Event[]> = {}
    for (const event of sortedEvents) {
      const key = `${event.startTime.getFullYear()}-${String(event.startTime.getMonth() + 1).padStart(2, '0')}-${String(event.startTime.getDate()).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [sortedEvents])

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">事件列表</h2>
      </div>

      <div className="divide-y divide-slate-100">
        {groupedEvents.map(([dateKey, events]) => {
          const date = new Date(dateKey)
          const isToday = isSameDay(date, new Date())

          return (
            <div className="px-4 py-4" key={dateKey}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{formatDateFull(date)}</h3>
                <span className="text-xs text-slate-500">{WEEK_DAYS[date.getDay()]}</span>
                {isToday ? (
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                    今天
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 pl-2">
                {events.map((event) => (
                  <EventCard event={event} key={event.id} onClick={onEventClick} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Calendar Container ───

export type CalendarViewType = 'day' | 'week' | 'month' | 'list'

export function CalendarContainer({
  view,
  currentDate,
  onEventClick,
}: {
  view: CalendarViewType
  currentDate: Date
  onEventClick: (event: Event) => void
}) {
  switch (view) {
    case 'day':
      return <DayView date={currentDate} onEventClick={onEventClick} />
    case 'week': {
      const weekStart = getWeekStart(currentDate)
      return <WeekView onEventClick={onEventClick} weekStart={weekStart} />
    }
    case 'month':
      return (
        <MonthView
          month={currentDate.getMonth()}
          onEventClick={onEventClick}
          year={currentDate.getFullYear()}
        />
      )
    case 'list':
      return <ListView onEventClick={onEventClick} />
    default:
      return null
  }
}

// ─── Navigation Helpers ───

export function navigateDate(date: Date, view: CalendarViewType, direction: 'prev' | 'next'): Date {
  const d = new Date(date)
  if (view === 'day') {
    d.setDate(d.getDate() + (direction === 'next' ? 1 : -1))
  } else if (view === 'week') {
    d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
  } else if (view === 'month') {
    d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
  } else {
    d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
  }
  return d
}

export function getDateRangeLabel(date: Date, view: CalendarViewType): string {
  if (view === 'day') {
    return formatDateFull(date)
  }
  if (view === 'week') {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `${formatDateShort(start)} - ${formatDateShort(end)}`
  }
  if (view === 'month') {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }
  return `${date.getFullYear()}年`
}

export function CalendarViewSwitcher({
  view,
  onChange,
}: {
  view: CalendarViewType
  onChange: (view: CalendarViewType) => void
}) {
  const options: { value: CalendarViewType; label: string }[] = [
    { value: 'day', label: '日' },
    { value: 'week', label: '周' },
    { value: 'month', label: '月' },
    { value: 'list', label: '列表' },
  ]

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
      {options.map((opt) => (
        <button
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            view === opt.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function DateNavigator({
  date,
  view,
  onNavigate,
  onToday,
}: {
  date: Date
  view: CalendarViewType
  onNavigate: (direction: 'prev' | 'next') => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
        <button
          aria-label="上一个"
          className="flex h-8 w-8 items-center justify-center rounded-l-lg text-slate-600 transition hover:bg-slate-50"
          onClick={() => onNavigate('prev')}
          type="button"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="下一个"
          className="flex h-8 w-8 items-center justify-center rounded-r-lg border-l border-slate-100 text-slate-600 transition hover:bg-slate-50"
          onClick={() => onNavigate('next')}
          type="button"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <button
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        onClick={onToday}
        type="button"
      >
        今天
      </button>
      <h2 className="ml-2 hidden truncate text-lg font-semibold text-slate-900 sm:block">
        {getDateRangeLabel(date, view)}
      </h2>
    </div>
  )
}
