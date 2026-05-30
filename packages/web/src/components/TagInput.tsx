import { useEffect, useRef, useState } from 'react'

import { appendTag, normalizeTag, parseTagInput } from '../lib/tags'
import { TagChip } from './TagChip'

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
  id?: string
}

// Chip-style multi-input.
// - Accepts both `,` and `，` and newlines as separators
// - Enter commits the current draft (unless IME composition is active)
// - Backspace on empty input removes the last chip
// - Suggestion dropdown filters by substring (case-insensitive on ASCII; for
//   Chinese we just do substring includes)
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = '输入标签后按 Enter 添加',
  id,
}: TagInputProps) {
  const [draft, setDraft] = useState('')
  const [composing, setComposing] = useState(false)
  const [focused, setFocused] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmedDraft = draft.trim()
  const filteredSuggestions = suggestions
    .filter((s) => !value.includes(s))
    .filter((s) => (trimmedDraft ? s.includes(trimmedDraft) : true))
    .slice(0, 8)

  const showDropdown = focused && filteredSuggestions.length > 0

  useEffect(() => {
    if (activeIdx >= filteredSuggestions.length) setActiveIdx(-1)
  }, [filteredSuggestions.length, activeIdx])

  function commitDraft() {
    if (composing) return
    const parsed = parseTagInput(draft)
    if (parsed.length === 0) return
    let next = value
    for (const t of parsed) next = appendTag(next, t)
    if (next !== value) onChange(next)
    setDraft('')
    setActiveIdx(-1)
  }

  function pickSuggestion(s: string) {
    const next = appendTag(value, s)
    if (next !== value) onChange(next)
    setDraft('')
    setActiveIdx(-1)
    inputRef.current?.focus()
  }

  function removeTag(t: string) {
    onChange(value.filter((x) => x !== t))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (composing || e.nativeEvent.isComposing) return

    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && activeIdx < filteredSuggestions.length) {
        pickSuggestion(filteredSuggestions[activeIdx])
      } else {
        commitDraft()
      }
      return
    }
    if (e.key === ',' || e.key === '，') {
      e.preventDefault()
      commitDraft()
      return
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault()
      onChange(value.slice(0, -1))
      return
    }
    if (e.key === 'ArrowDown' && showDropdown) {
      e.preventDefault()
      setActiveIdx((i) => Math.min(filteredSuggestions.length - 1, i + 1))
      return
    }
    if (e.key === 'ArrowUp' && showDropdown) {
      e.preventDefault()
      setActiveIdx((i) => Math.max(-1, i - 1))
      return
    }
    if (e.key === 'Escape' && showDropdown) {
      e.preventDefault()
      setActiveIdx(-1)
      // also clear focus visual; we don't blur to keep keyboard flow.
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t) => (
          <TagChip key={t} onRemove={removeTag} tag={t} />
        ))}
        <input
          aria-label="标签输入"
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
          id={id}
          onBlur={() => {
            // commit any pending draft on blur so the user doesn't lose typed text
            commitDraft()
            // delay so suggestion mousedown can still register
            setTimeout(() => setFocused(false), 100)
          }}
          onChange={(e) => setDraft(e.target.value)}
          onCompositionEnd={() => setComposing(false)}
          onCompositionStart={() => setComposing(true)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          type="text"
          value={draft}
        />
      </div>

      {showDropdown && (
        <ul
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filteredSuggestions.map((s, i) => (
            <li key={s}>
              <button
                aria-selected={activeIdx === i}
                className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition ${
                  activeIdx === i ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseDown={(e) => {
                  // prevent input blur which would re-fire commitDraft
                  e.preventDefault()
                  pickSuggestion(s)
                }}
                role="option"
                type="button"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      {trimmedDraft &&
      !filteredSuggestions.includes(trimmedDraft) &&
      !value.includes(trimmedDraft) ? (
        <p className="mt-1 text-xs text-slate-400">
          按 Enter 新增标签「{normalizeTag(trimmedDraft)}」
        </p>
      ) : null}
    </div>
  )
}
