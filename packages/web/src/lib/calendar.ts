import type { Event } from './models'

const HOUR_HEIGHT = 64
const EVENT_TOP_INSET = 2
const EVENT_BOTTOM_GAP = 6
const EVENT_MIN_HEIGHT = 24
const MINUTES_PER_HOUR = 60

export interface TimedEventLayout {
  event: Event
  top: number
  height: number
  lane: number
  laneCount: number
}

interface TimedEventSegment {
  event: Event
  top: number
  height: number
  displayBottom: number
  actualStart: number
  actualEnd: number
  lane: number
  laneCount: number
}

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

function getMinutesSinceDayStart(date: Date): number {
  return (
    date.getHours() * MINUTES_PER_HOUR +
    date.getMinutes() +
    date.getSeconds() / MINUTES_PER_HOUR +
    date.getMilliseconds() / 60000
  )
}

function getEffectiveEndTime(event: Event): Date {
  if (event.endTime && event.endTime.getTime() > event.startTime.getTime()) {
    return event.endTime
  }

  return new Date(event.startTime.getTime() + MINUTES_PER_HOUR * 60 * 1000)
}

function toTimedEventSegment(event: Event): TimedEventSegment {
  const effectiveEndTime = getEffectiveEndTime(event)
  const startMinutes = getMinutesSinceDayStart(event.startTime)
  const durationMinutes = (effectiveEndTime.getTime() - event.startTime.getTime()) / 60000
  const endMinutes = Math.min(startMinutes + durationMinutes, 24 * MINUTES_PER_HOUR)
  const top = (startMinutes / MINUTES_PER_HOUR) * HOUR_HEIGHT + EVENT_TOP_INSET
  const height = Math.max(
    ((endMinutes - startMinutes) / MINUTES_PER_HOUR) * HOUR_HEIGHT - EVENT_BOTTOM_GAP,
    EVENT_MIN_HEIGHT,
  )

  return {
    event,
    top,
    height,
    displayBottom: top + height,
    actualStart: event.startTime.getTime(),
    actualEnd: effectiveEndTime.getTime(),
    lane: 0,
    laneCount: 1,
  }
}

function segmentsCollideWithGroup(
  segment: TimedEventSegment,
  groupDisplayBottom: number,
  groupActualEnd: number,
): boolean {
  return segment.top < groupDisplayBottom || segment.actualStart < groupActualEnd
}

function assignLanes(group: TimedEventSegment[]): void {
  const laneEnds: { actualEnd: number; displayBottom: number }[] = []

  for (const segment of group) {
    let lane = laneEnds.findIndex(
      (end) => segment.actualStart >= end.actualEnd && segment.top >= end.displayBottom,
    )

    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push({ actualEnd: segment.actualEnd, displayBottom: segment.displayBottom })
    } else {
      laneEnds[lane] = {
        actualEnd: segment.actualEnd,
        displayBottom: segment.displayBottom,
      }
    }

    segment.lane = lane
  }

  for (const segment of group) {
    segment.laneCount = laneEnds.length
  }
}

export function getTimedEventLayouts(events: Event[]): TimedEventLayout[] {
  const segments = events.map(toTimedEventSegment).sort((a, b) => {
    const startDelta = a.actualStart - b.actualStart
    if (startDelta !== 0) return startDelta

    const durationDelta = b.actualEnd - a.actualEnd
    if (durationDelta !== 0) return durationDelta

    return a.event.id.localeCompare(b.event.id)
  })

  const groups: TimedEventSegment[][] = []
  let group: TimedEventSegment[] = []
  let groupDisplayBottom = Number.NEGATIVE_INFINITY
  let groupActualEnd = Number.NEGATIVE_INFINITY

  for (const segment of segments) {
    if (
      group.length === 0 ||
      segmentsCollideWithGroup(segment, groupDisplayBottom, groupActualEnd)
    ) {
      group.push(segment)
      groupDisplayBottom = Math.max(groupDisplayBottom, segment.displayBottom)
      groupActualEnd = Math.max(groupActualEnd, segment.actualEnd)
      continue
    }

    groups.push(group)
    group = [segment]
    groupDisplayBottom = segment.displayBottom
    groupActualEnd = segment.actualEnd
  }

  if (group.length > 0) {
    groups.push(group)
  }

  for (const collisionGroup of groups) {
    assignLanes(collisionGroup)
  }

  return segments.map(({ event, top, height, lane, laneCount }) => ({
    event,
    top,
    height,
    lane,
    laneCount,
  }))
}
