import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The small ⓘ beside a figure's label, explaining what the figure counts.
 *
 * Drawn here rather than left to the browser's `title`: a native tooltip waits
 * a second, cannot be styled, and never appears on touch. This one shows on
 * hover and on keyboard focus — which is why the mark itself is tabbable — and
 * the same sentence is the trigger's accessible name, so a screen reader gets
 * the explanation without ever seeing the box.
 *
 * Opaque rather than glass. It lands on live content — the masthead above it,
 * the figures beside it — and a blurred panel over a bright number leaves the
 * number reading straight through the sentence meant to explain it.
 */
export function InfoTip({
  text,
  align = 'start',
  className,
}: {
  text: string
  /**
   * Which edge the box hangs from. A cell at the right of the grid has to open
   * leftwards or the box runs off the card — there is no measuring here, so the
   * caller says which side it is on.
   */
  align?: 'start' | 'end'
  className?: string
}) {
  return (
    <span className={cn('group relative inline-flex align-middle', className)}>
      <span
        tabIndex={0}
        role="note"
        aria-label={text}
        className="text-dim hover:text-muted focus-visible:text-muted inline-flex cursor-help items-center rounded-full transition-colors"
      >
        <Info className="size-3" aria-hidden="true" />
      </span>

      {/*
        Above the mark, not below it. These sit on the top row of a grid of
        figures, and a box opening downwards would cover the very number the
        sentence is describing.
      */}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          'border-border solid-raised text-fg pointer-events-none absolute bottom-full z-30 mb-2.5 w-56 rounded-lg border px-3 py-2 text-[12px] leading-snug font-normal tracking-normal normal-case opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100',
          // Hung from the mark's own edge so the caret below still lands on it.
          align === 'end' ? 'right-[-8px]' : 'left-[-8px]',
        )}
      >
        {text}
        <span
          aria-hidden="true"
          className={cn(
            'solid-flat border-border absolute top-full size-2 -translate-y-1/2 rotate-45 border-r border-b',
            align === 'end' ? 'right-[10px]' : 'left-[10px]',
          )}
        />
      </span>
    </span>
  )
}
