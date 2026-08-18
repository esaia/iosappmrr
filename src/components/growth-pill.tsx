import { cn, formatGrowth } from '@/lib/utils'

/**
 * Month-over-month change. Green here always means the same thing — MRR is
 * higher than it was 30 days ago — and the sign carries it again for anyone who
 * can't see the colour.
 */
export function GrowthPill({ value, className }: { value: number | null; className?: string }) {
  const label = formatGrowth(value)

  if (label === null) {
    return (
      <span
        className={cn('text-dim text-xs', className)}
        title="Not enough history yet — growth appears after 30 days of synced revenue."
      >
        —<span className="sr-only">No growth figure yet</span>
      </span>
    )
  }

  const rising = (value ?? 0) >= 0

  return (
    <span
      className={cn('tabular text-xs font-medium', rising ? 'text-green' : 'text-red', className)}
      title="Change in MRR over the last 30 days"
    >
      {label}
    </span>
  )
}
