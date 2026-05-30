import type { Event } from '../data/mock'

const TAG_DELIMITER_RE = /[,，\n]+/

export function normalizeTag(raw: string): string {
  return raw.trim()
}

// Parse free-form text (e.g. "工作,客户,  团队 ") into a deduped tag list.
// Accepts both `,` and `，` (Chinese full-width comma) and newlines.
export function parseTagInput(raw: string): string[] {
  if (!raw) return []
  const parts = raw
    .split(TAG_DELIMITER_RE)
    .map(normalizeTag)
    .filter((t) => t.length > 0)
  return Array.from(new Set(parts))
}

// Add `next` to `current`, returning a new deduped list. Preserves insertion order.
export function appendTag(current: string[], next: string): string[] {
  const t = normalizeTag(next)
  if (!t) return current
  if (current.includes(t)) return current
  return [...current, t]
}

// All distinct tag names appearing across the event set, sorted.
export function getAllTagNames(events: Event[]): string[] {
  const set = new Set<string>()
  for (const e of events) {
    if (!e.tags) continue
    for (const t of e.tags) {
      const n = normalizeTag(t)
      if (n) set.add(n)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

// Count how many events use each tag (for the manager page).
export function getTagUsageCounts(events: Event[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of events) {
    if (!e.tags) continue
    for (const t of e.tags) {
      const n = normalizeTag(t)
      if (!n) continue
      map.set(n, (map.get(n) ?? 0) + 1)
    }
  }
  return map
}
