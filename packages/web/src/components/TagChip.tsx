import { X } from 'lucide-react'

import { getTagPalette } from '../lib/tagPalette'

interface BaseProps {
  tag: string
  size?: 'sm' | 'md'
  className?: string
}

type TagChipProps =
  | (BaseProps & {
      clickable: true
      onClick: (tag: string) => void
      onRemove?: never
      faded?: boolean
      ariaLabel?: string
    })
  | (BaseProps & {
      clickable?: false
      onClick?: never
      onRemove?: (tag: string) => void
      faded?: boolean
      ariaLabel?: never
    })

// A colored pill representing a single tag. Behaviour:
//   - Default: static colored pill
//   - clickable: render as a button that calls onClick(tag)
//   - onRemove: render an `x` icon button inside the pill
//   - faded: low opacity + strikethrough, used for "hidden" state in filter bar
export function TagChip(props: TagChipProps) {
  const { tag, size = 'sm', className } = props
  const palette = getTagPalette(tag)
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  const baseClasses = `inline-flex items-center gap-1 rounded-md border ${palette.pillBg} ${palette.pillText} ${palette.pillBorder} ${sizeClasses}`
  const fadedClasses = props.faded ? 'opacity-50 line-through' : ''

  if (props.clickable) {
    return (
      <button
        aria-label={props.ariaLabel ?? `按标签「${tag}」聚焦`}
        className={`${baseClasses} ${palette.pillHover} cursor-pointer transition ${fadedClasses} ${className ?? ''}`}
        onClick={() => props.onClick(tag)}
        type="button"
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />
        {tag}
      </button>
    )
  }

  if (props.onRemove) {
    return (
      <span className={`${baseClasses} ${fadedClasses} ${className ?? ''}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />
        {tag}
        <button
          aria-label={`移除标签 ${tag}`}
          className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full transition hover:bg-black/10"
          onClick={() => props.onRemove?.(tag)}
          type="button"
        >
          <X size={10} />
        </button>
      </span>
    )
  }

  return (
    <span className={`${baseClasses} ${fadedClasses} ${className ?? ''}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} />
      {tag}
    </span>
  )
}
