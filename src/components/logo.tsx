import Link from 'next/link'
import { cn } from '@/lib/utils'
import { site } from '@/lib/site'

/**
 * The mark sits in a rounded tile the way an app icon does — the shape a reader
 * of this site sees a hundred times a day on a home screen, and the one piece
 * of Apple's vocabulary that costs nothing to borrow. Inside it, a star: the
 * shape the App Store already uses where it asks people to trust a number.
 *
 * The tile is filled with the accent rather than glass, because a logo has to
 * survive being placed on a glass surface. Two translucent layers stacked would
 * leave it barely there.
 */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const lg = size === 'lg'
  return (
    <Link href="/" className={cn('group inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'glossy bg-accent grid shrink-0 place-items-center',
          lg ? 'size-9 rounded-[10px]' : 'size-7 rounded-[8px]',
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn('text-white', lg ? 'size-5' : 'size-4')}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27l-6.18 3.23L7 13.63l-5-4.87 6.91-1L12 1.5z" />
        </svg>
      </span>
      <span className={cn('text-fg font-bold tracking-tight', lg ? 'text-[22px]' : 'text-[15px]')}>
        {site.wordmark.main}
        {site.wordmark.suffix && <span className="text-muted">{site.wordmark.suffix}</span>}
      </span>
    </Link>
  )
}
