import { cn } from '@/lib/utils'

/**
 * Apple's logo, drawn at the weight of a piece of text rather than as an image.
 *
 * It is here to name a source — these are App Store apps, and the mark says so
 * faster than the words do. It is deliberately never used as a badge, a seal, or
 * anything that could read as Apple having approved of this site: the mark is
 * Apple's trademark, this site is not licensed to use it, and the footer says
 * plainly that the two are unaffiliated. Keep it beside the words "App Store",
 * where it describes, and nowhere that it could endorse.
 *
 * `currentColor` and an em-relative size mean it inherits from whatever line it
 * sits on, so it lines up with the text instead of floating against it.
 */
export function AppleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-[1.1em] shrink-0', className)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}
