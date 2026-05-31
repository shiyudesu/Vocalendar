import { describe, expect, test } from 'vitest'

import { getTimedEventLayouts } from './calendar'
import type { Event } from './models'

function at(hour: number, minute: number): Date {
  return new Date(2026, 5, 1, hour, minute, 0, 0)
}

function event(
  id: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): Event {
  return {
    id,
    userId: 'user-001',
    title: id,
    startTime: at(startHour, startMinute),
    endTime: at(endHour, endMinute),
    timezone: 'Asia/Shanghai',
    reminders: [],
    priority: 'normal',
    source: 'manual',
    createdAt: at(8, 0),
    updatedAt: at(8, 0),
  }
}

describe('getTimedEventLayouts', () => {
  test('places overlapping events in separate horizontal lanes', () => {
    const layouts = getTimedEventLayouts([
      event('a', 10, 0, 11, 0),
      event('b', 10, 15, 10, 45),
      event('c', 11, 0, 12, 0),
    ])

    const byId = new Map(layouts.map((layout) => [layout.event.id, layout]))

    expect(byId.get('a')?.laneCount).toBe(2)
    expect(byId.get('b')?.laneCount).toBe(2)
    expect(byId.get('a')?.lane).not.toBe(byId.get('b')?.lane)
    expect(byId.get('c')?.laneCount).toBe(1)
    expect(byId.get('c')?.lane).toBe(0)
  })

  test('separates short nearby events when minimum rendered height would collide', () => {
    const layouts = getTimedEventLayouts([event('a', 10, 0, 10, 5), event('b', 10, 10, 10, 15)])

    const byId = new Map(layouts.map((layout) => [layout.event.id, layout]))

    expect(byId.get('a')?.laneCount).toBe(2)
    expect(byId.get('b')?.laneCount).toBe(2)
    expect(byId.get('a')?.lane).not.toBe(byId.get('b')?.lane)
  })

  test('reuses a lane inside the same collision group once vertical space is free', () => {
    const layouts = getTimedEventLayouts([
      event('a', 9, 0, 10, 0),
      event('b', 9, 30, 10, 30),
      event('c', 10, 0, 11, 0),
    ])

    const byId = new Map(layouts.map((layout) => [layout.event.id, layout]))

    expect(byId.get('a')?.laneCount).toBe(2)
    expect(byId.get('b')?.laneCount).toBe(2)
    expect(byId.get('c')?.laneCount).toBe(2)
    expect(byId.get('c')?.lane).toBe(byId.get('a')?.lane)
  })
})
