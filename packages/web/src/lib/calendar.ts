import type { Event } from './models'

export function getEventsForDate(events: Event[], date: Date): Event[] {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

  return events.filter((event) => {
    if (event.allDay) {
      const eventDay = new Date(
        event.startTime.getFullYear(),
        event.startTime.getMonth(),
        event.startTime.getDate(),
      )
      return (
        eventDay.getFullYear() === startOfDay.getFullYear() &&
        eventDay.getMonth() === startOfDay.getMonth() &&
        eventDay.getDate() === startOfDay.getDate()
      )
    }

    return event.startTime >= startOfDay && event.startTime <= endOfDay
  })
}

export function getEventsForWeek(events: Event[], weekStart: Date): Event[] {
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return events.filter((event) => {
    const eventStart = event.startTime
    return eventStart >= start && eventStart <= end
  })
}

export function getEventsForMonth(events: Event[], year: number, month: number): Event[] {
  const start = new Date(year, month, 1, 0, 0, 0)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  return events.filter((event) => {
    const eventStart = event.startTime
    return eventStart >= start && eventStart <= end
  })
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-rose-500'
    case 'normal':
      return 'bg-teal-500'
    case 'low':
      return 'bg-slate-400'
    default:
      return 'bg-slate-400'
  }
}
