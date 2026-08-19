import { ANONYMOUS_NOTE } from '@/lib/anonymous'
import { cn } from '@/lib/utils'

/**
 * The blurred stand-in where an anonymous listing's own words would be — its
 * name, its tagline, its description.
 *
 * The blur is a signal, not a security measure: what it covers is already a
 * placeholder, because the real text is dropped in the query. Blurring rather
 * than printing "Anonymous" in plain type keeps the shape of the thing that is
 * missing, so the page still reads as a listing and the withholding reads as
 * deliberate rather than as a bug.
 *
 * The tooltip is opt-in, and only the title asks for it. One explanation per
 * page is the whole of the message; repeating it on the tagline and again on
 * the description means three boxes covering the very text they explain — and
 * a tooltip over a paragraph has to sit somewhere, which turned out to be on
 * top of the heading above it.
 *
 * Where it is shown it is drawn here rather than left to the browser's `title`:
 * a native tooltip waits a second, cannot be styled, and never appears on
 * touch. This one shows on hover and on keyboard focus, which is why that span
 * alone is tabbable. Either way the note is the accessible name — the blurred
 * text underneath is decoration, and hidden from screen readers.
 */
export function AnonymousName({
  children,
  className,
  block,
  tooltip,
}: {
  children: React.ReactNode
  className?: string
  /** Paragraph-shaped rather than word-shaped. */
  block?: boolean
  /** Explains the blur on hover. Reserve it for the listing's title. */
  tooltip?: boolean
}) {
  return (
    <span
      tabIndex={tooltip ? 0 : undefined}
      role="note"
      aria-label={ANONYMOUS_NOTE}
      className={cn(
        'group relative focus:outline-none',
        tooltip && 'cursor-help',
        block ? 'block' : 'inline-block align-bottom',
        className,
      )}
    >
      <span aria-hidden="true" className="block blur-[0.2em] select-none">
        {children}
      </span>

      {tooltip && (
        <span
          role="tooltip"
          className="border-border solid-raised text-fg pointer-events-none absolute top-full left-0 z-20 mt-2 rounded-lg border px-3 py-1.5 text-xs font-normal whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
        >
          {ANONYMOUS_NOTE}
        </span>
      )}
    </span>
  )
}
