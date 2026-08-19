import { cn } from '@/lib/utils'

/**
 * A founder's picture at list size, beside their name.
 *
 * A circle, not the squircle the app icons use. The shape is doing work here:
 * a row already carries an app icon, and making the person round is what stops
 * a reader parsing the two as the same kind of thing.
 *
 * Deliberately not run through `highResAvatar`: that swaps X's `_normal` file
 * for the 400x400 one, which is the right trade on a profile header and the
 * wrong one here — a leaderboard would fetch a hundred full-size portraits to
 * draw them at 28px. The default `_normal` is 48px, which covers this slot on
 * an ordinary display and very nearly on a retina one.
 *
 * Falls back to the first letter rather than to a silhouette, so a founder who
 * signed in without a picture still gets something that identifies them.
 */
export function FounderAvatar({
  avatarUrl,
  name,
  size = 28,
  className,
}: {
  avatarUrl: string | null | undefined
  /** Display name, or the handle when there is none — used for the initial. */
  name: string
  size?: number
  className?: string
}) {
  const shared = 'shrink-0 rounded-full object-cover'

  if (!avatarUrl) {
    return (
      <span
        className={cn(shared, 'bg-surface-3 text-dim grid place-items-center font-bold', className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={cn(shared, className)}
      style={{ width: size, height: size }}
    />
  )
}
