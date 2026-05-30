import { Crosshair } from 'lucide-react'
import { useMemo } from 'react'

import { getTagPalette } from '../lib/tagPalette'

interface TagFilterBarProps {
  allTags: string[]
  hiddenTags: Set<string>
  onToggle: (tag: string) => void
  onFocus: (tag: string) => void
  onClear: () => void
}

// A horizontal scrollable list of tag chips above the calendar.
// Each chip has two actions:
//   - click the body → toggle visibility (hide/show)
//   - click the small crosshair on the right → focus mode (hide all others)
// Untagged events are never affected by this bar (always visible) so we don't
// add an "untagged" chip.
export function TagFilterBar({
  allTags,
  hiddenTags,
  onToggle,
  onFocus,
  onClear,
}: TagFilterBarProps) {
  const sorted = useMemo(() => [...allTags].sort((a, b) => a.localeCompare(b, 'zh-CN')), [allTags])
  const hiddenCount = useMemo(
    () => sorted.filter((t) => hiddenTags.has(t)).length,
    [sorted, hiddenTags],
  )

  if (sorted.length === 0) return null

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 md:px-6">
      <span className="shrink-0 text-xs text-slate-400">标签筛选</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {sorted.map((tag) => {
          const palette = getTagPalette(tag)
          const hidden = hiddenTags.has(tag)
          return (
            <span
              className={`group inline-flex items-stretch overflow-hidden rounded-md border text-[11px] transition ${
                hidden
                  ? 'border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-90'
                  : `${palette.chipActiveBg} ${palette.chipActiveText} ${palette.chipActiveBorder}`
              }`}
              key={tag}
            >
              <button
                aria-label={hidden ? `显示标签「${tag}」` : `隐藏标签「${tag}」`}
                aria-pressed={!hidden}
                className={`inline-flex items-center gap-1 px-2 py-0.5 ${hidden ? 'line-through' : ''}`}
                onClick={() => onToggle(tag)}
                type="button"
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />
                {tag}
              </button>
              <button
                aria-label={`仅显示标签「${tag}」`}
                className={`inline-flex items-center border-l px-1.5 transition ${
                  hidden
                    ? 'border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                    : `${palette.chipActiveBorder} hover:bg-white/40`
                }`}
                onClick={() => onFocus(tag)}
                title="只看此标签"
                type="button"
              >
                <Crosshair size={10} />
              </button>
            </span>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <button
          className="shrink-0 text-xs font-medium text-teal-700 transition hover:text-teal-800"
          onClick={onClear}
          type="button"
        >
          清除筛选 ({hiddenCount})
        </button>
      )}
    </div>
  )
}
