// Static Tailwind class palette for tag coloring.
// IMPORTANT: All class names MUST be full literal strings so Tailwind's JIT
// scanner can pick them up. Do NOT build class names by string interpolation.

export interface TagPalette {
  readonly name: string
  readonly dot: string
  readonly pillBg: string
  readonly pillText: string
  readonly pillBorder: string
  readonly pillHover: string
  readonly eventBg: string
  readonly eventBorder: string
  readonly eventHover: string
  readonly eventText: string
  readonly chipActiveBg: string
  readonly chipActiveText: string
  readonly chipActiveBorder: string
}

export const TAG_PALETTES: readonly TagPalette[] = [
  {
    name: 'teal',
    dot: 'bg-teal-500',
    pillBg: 'bg-teal-50',
    pillText: 'text-teal-700',
    pillBorder: 'border-teal-200',
    pillHover: 'hover:bg-teal-100',
    eventBg: 'bg-teal-50',
    eventBorder: 'border-teal-200',
    eventHover: 'hover:bg-teal-100',
    eventText: 'text-teal-900',
    chipActiveBg: 'bg-teal-100',
    chipActiveText: 'text-teal-800',
    chipActiveBorder: 'border-teal-300',
  },
  {
    name: 'sky',
    dot: 'bg-sky-500',
    pillBg: 'bg-sky-50',
    pillText: 'text-sky-700',
    pillBorder: 'border-sky-200',
    pillHover: 'hover:bg-sky-100',
    eventBg: 'bg-sky-50',
    eventBorder: 'border-sky-200',
    eventHover: 'hover:bg-sky-100',
    eventText: 'text-sky-900',
    chipActiveBg: 'bg-sky-100',
    chipActiveText: 'text-sky-800',
    chipActiveBorder: 'border-sky-300',
  },
  {
    name: 'indigo',
    dot: 'bg-indigo-500',
    pillBg: 'bg-indigo-50',
    pillText: 'text-indigo-700',
    pillBorder: 'border-indigo-200',
    pillHover: 'hover:bg-indigo-100',
    eventBg: 'bg-indigo-50',
    eventBorder: 'border-indigo-200',
    eventHover: 'hover:bg-indigo-100',
    eventText: 'text-indigo-900',
    chipActiveBg: 'bg-indigo-100',
    chipActiveText: 'text-indigo-800',
    chipActiveBorder: 'border-indigo-300',
  },
  {
    name: 'violet',
    dot: 'bg-violet-500',
    pillBg: 'bg-violet-50',
    pillText: 'text-violet-700',
    pillBorder: 'border-violet-200',
    pillHover: 'hover:bg-violet-100',
    eventBg: 'bg-violet-50',
    eventBorder: 'border-violet-200',
    eventHover: 'hover:bg-violet-100',
    eventText: 'text-violet-900',
    chipActiveBg: 'bg-violet-100',
    chipActiveText: 'text-violet-800',
    chipActiveBorder: 'border-violet-300',
  },
  {
    name: 'pink',
    dot: 'bg-pink-500',
    pillBg: 'bg-pink-50',
    pillText: 'text-pink-700',
    pillBorder: 'border-pink-200',
    pillHover: 'hover:bg-pink-100',
    eventBg: 'bg-pink-50',
    eventBorder: 'border-pink-200',
    eventHover: 'hover:bg-pink-100',
    eventText: 'text-pink-900',
    chipActiveBg: 'bg-pink-100',
    chipActiveText: 'text-pink-800',
    chipActiveBorder: 'border-pink-300',
  },
  {
    name: 'rose',
    dot: 'bg-rose-500',
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200',
    pillHover: 'hover:bg-rose-100',
    eventBg: 'bg-rose-50',
    eventBorder: 'border-rose-200',
    eventHover: 'hover:bg-rose-100',
    eventText: 'text-rose-900',
    chipActiveBg: 'bg-rose-100',
    chipActiveText: 'text-rose-800',
    chipActiveBorder: 'border-rose-300',
  },
  {
    name: 'amber',
    dot: 'bg-amber-500',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-700',
    pillBorder: 'border-amber-200',
    pillHover: 'hover:bg-amber-100',
    eventBg: 'bg-amber-50',
    eventBorder: 'border-amber-200',
    eventHover: 'hover:bg-amber-100',
    eventText: 'text-amber-900',
    chipActiveBg: 'bg-amber-100',
    chipActiveText: 'text-amber-800',
    chipActiveBorder: 'border-amber-300',
  },
  {
    name: 'emerald',
    dot: 'bg-emerald-500',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-700',
    pillBorder: 'border-emerald-200',
    pillHover: 'hover:bg-emerald-100',
    eventBg: 'bg-emerald-50',
    eventBorder: 'border-emerald-200',
    eventHover: 'hover:bg-emerald-100',
    eventText: 'text-emerald-900',
    chipActiveBg: 'bg-emerald-100',
    chipActiveText: 'text-emerald-800',
    chipActiveBorder: 'border-emerald-300',
  },
  {
    name: 'cyan',
    dot: 'bg-cyan-500',
    pillBg: 'bg-cyan-50',
    pillText: 'text-cyan-700',
    pillBorder: 'border-cyan-200',
    pillHover: 'hover:bg-cyan-100',
    eventBg: 'bg-cyan-50',
    eventBorder: 'border-cyan-200',
    eventHover: 'hover:bg-cyan-100',
    eventText: 'text-cyan-900',
    chipActiveBg: 'bg-cyan-100',
    chipActiveText: 'text-cyan-800',
    chipActiveBorder: 'border-cyan-300',
  },
  {
    name: 'orange',
    dot: 'bg-orange-500',
    pillBg: 'bg-orange-50',
    pillText: 'text-orange-700',
    pillBorder: 'border-orange-200',
    pillHover: 'hover:bg-orange-100',
    eventBg: 'bg-orange-50',
    eventBorder: 'border-orange-200',
    eventHover: 'hover:bg-orange-100',
    eventText: 'text-orange-900',
    chipActiveBg: 'bg-orange-100',
    chipActiveText: 'text-orange-800',
    chipActiveBorder: 'border-orange-300',
  },
]

export const UNTAGGED_PALETTE: TagPalette = TAG_PALETTES[0]

// djb2 hash — stable across sessions, decent distribution over short Chinese strings.
export function hashTagName(name: string): number {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getTagPalette(name: string): TagPalette {
  if (!name) return UNTAGGED_PALETTE
  return TAG_PALETTES[hashTagName(name) % TAG_PALETTES.length]
}
