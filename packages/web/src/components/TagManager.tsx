import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Event } from '../data/mock'
import { getTagPalette } from '../lib/tagPalette'
import { normalizeTag } from '../lib/tags'
import { TagChip } from './TagChip'

interface TagManagerProps {
  events: Event[]
  hiddenTags: Set<string>
  onRename: (from: string, to: string) => void
  onDelete: (tag: string) => void
}

interface RenameState {
  tag: string
  draft: string
}

interface ConfirmMergeState {
  from: string
  to: string
  affectedCount: number
}

interface ConfirmDeleteState {
  tag: string
  affectedCount: number
}

export function TagManager({ events, hiddenTags, onRename, onDelete }: TagManagerProps) {
  // Rebuild usage map locally so we don't need to thread it through props.
  const usage = useMemo(() => {
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
  }, [events])

  const sortedTags = useMemo(
    () => Array.from(usage.keys()).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [usage],
  )

  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [confirmMerge, setConfirmMerge] = useState<ConfirmMergeState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(null)

  function startRename(tag: string) {
    setRenaming({ tag, draft: tag })
  }

  function commitRename() {
    if (!renaming) return
    const target = normalizeTag(renaming.draft)
    if (!target || target === renaming.tag) {
      setRenaming(null)
      return
    }
    // Conflict with existing tag → confirm merge
    if (usage.has(target)) {
      setConfirmMerge({
        from: renaming.tag,
        to: target,
        affectedCount: usage.get(renaming.tag) ?? 0,
      })
      return
    }
    onRename(renaming.tag, target)
    setRenaming(null)
  }

  function applyMerge() {
    if (!confirmMerge) return
    onRename(confirmMerge.from, confirmMerge.to)
    setConfirmMerge(null)
    setRenaming(null)
  }

  function askDelete(tag: string) {
    setConfirmDelete({ tag, affectedCount: usage.get(tag) ?? 0 })
  }

  function applyDelete() {
    if (!confirmDelete) return
    onDelete(confirmDelete.tag)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">标签管理</h3>
        <p className="text-sm text-slate-500">
          重命名或删除已有标签。{' '}
          <span className="text-amber-600">
            注意：当前为本地预览，刷新后会还原。后端集成后将自动同步。
          </span>
        </p>
      </div>

      {sortedTags.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          暂无标签。在创建或编辑事件时输入标签后会出现在这里。
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedTags.map((tag) => {
            const palette = getTagPalette(tag)
            const isHidden = hiddenTags.has(tag)
            const isRenaming = renaming?.tag === tag

            return (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                key={tag}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isRenaming ? (
                    <div className="flex flex-1 items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${palette.dot}`} />
                      <input
                        aria-label={`重命名标签 ${tag}`}
                        autoFocus
                        className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        onChange={(e) =>
                          setRenaming((r) => (r ? { ...r, draft: e.target.value } : r))
                        }
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitRename()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setRenaming(null)
                          }
                        }}
                        type="text"
                        value={renaming.draft}
                      />
                    </div>
                  ) : (
                    <>
                      <TagChip size="md" tag={tag} />
                      <span className="text-xs text-slate-400">
                        {usage.get(tag) ?? 0} 个事件
                        {isHidden ? ' · 已在筛选中隐藏' : ''}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {isRenaming ? (
                    <>
                      <button
                        aria-label="确认重命名"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-teal-600 transition hover:bg-teal-50"
                        onClick={commitRename}
                        type="button"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        aria-label="取消重命名"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100"
                        onClick={() => setRenaming(null)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        aria-label={`重命名标签 ${tag}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => startRename(tag)}
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        aria-label={`删除标签 ${tag}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => askDelete(tag)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmMerge && (
        <ConfirmDialog
          confirmLabel="合并"
          message={`标签「${confirmMerge.from}」将合并到已有标签「${confirmMerge.to}」，影响 ${confirmMerge.affectedCount} 个事件。继续？`}
          onCancel={() => setConfirmMerge(null)}
          onConfirm={applyMerge}
          title="合并标签"
          tone="primary"
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          confirmLabel="删除"
          message={`将从 ${confirmDelete.affectedCount} 个事件中移除标签「${confirmDelete.tag}」，无法撤销。继续？`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={applyDelete}
          title="删除标签"
          tone="danger"
        />
      )}
    </div>
  )
}

// ─── Inline confirm dialog ─────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  tone: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className={`rounded-lg px-4 py-1.5 text-sm font-medium text-white transition ${
              tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
