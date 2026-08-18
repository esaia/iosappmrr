import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * A star for the mark — the shape the App Store uses for ratings, which is the
 * one place Apple already asks people to trust a number.
 */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <Link href="/" className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 24 24"
        className={size === 'lg' ? 'text-blue size-6' : 'text-blue size-[18px]'}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27l-6.18 3.23L7 13.63l-5-4.87 6.91-1L12 1.5z" />
      </svg>
      <span
        className={cn(
          'text-fg font-bold tracking-tight',
          size === 'lg' ? 'text-[22px]' : 'text-[15px]',
        )}
      >
        TrustMRR<span className="text-muted">·iOS</span>
      </span>
    </Link>
  )
}
