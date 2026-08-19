import { cn } from '@/lib/utils'

/**
 * The page frame. Every page on the site sits in one of these, and it is the
 * same width and padding as the header and the footer — so a heading's first
 * character lands under the logo on every route, and a table's right edge lands
 * under the "Add app" button.
 *
 * Pages used to declare their own width, and had drifted to eight different
 * ones (6xl, 5xl, 4xl, 3xl, 2xl, lg, md and none), which meant the content
 * shifted sideways as you navigated.
 *
 * Never pass a `max-w-*` in `className`: Tailwind resolves conflicting
 * utilities by their order in the stylesheet, not the order in the string, so
 * which width won would be luck. Nest a `Measure` instead.
 */
export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6', className)} {...props} />
  )
}

/**
 * A readable column inside the frame, for prose and forms — the two things that
 * get worse, not better, as they get wider. A paragraph at the full 1152px runs
 * past the eye's comfortable line length, and a text input that wide looks
 * broken.
 *
 * Left-aligned by default, deliberately. Centring it would put its first
 * character somewhere different from every list page's, which is the
 * misalignment this whole arrangement exists to remove. A page with nothing
 * but the column on it — a form, say — has no list to line up with, so it can
 * opt into the middle by passing `mx-auto`.
 */
export function Measure({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('max-w-2xl', className)} {...props} />
}
