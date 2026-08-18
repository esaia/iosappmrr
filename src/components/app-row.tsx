import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { GrowthPill } from '@/components/growth-pill'
import type { AppListing } from '@/lib/data/apps'
import { cn, formatMoney } from '@/lib/utils'

/** Medals for the podium, plain numerals below it. */
function rankMark(rank: number) {
  return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] ?? rank
}

/**
 * One row of the leaderboard table. Columns line up across rows because every
 * figure is tabular monospace — the whole point of setting the site in mono.
 */
export function AppRow({
  app,
  rank,
  className,
}: {
  app: AppListing
  rank?: number
  className?: string
}) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className={cn(
        'group border-border hover:bg-surface-2 flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 sm:gap-4 sm:px-4',
        className,
      )}
    >
      {rank !== undefined && (
        <span className="tabular text-dim w-6 shrink-0 text-center text-xs" aria-hidden="true">
          {rankMark(rank)}
        </span>
      )}

      <AppIcon src={app.iconUrl} name={app.name} size={36} />

      <div className="min-w-0 flex-1">
        <h3 className="text-fg truncate text-[13px] font-bold">{app.name}</h3>
        <p className="text-muted truncate text-[11px]">{app.tagline ?? app.categoryName}</p>
      </div>

      <div className="hidden w-40 shrink-0 lg:block">
        {app.founderHandle && (
          <span className="text-muted truncate text-[12px]">@{app.founderHandle}</span>
        )}
      </div>

      <div className="tabular text-fg w-24 shrink-0 text-right text-[13px] font-bold sm:w-28">
        {formatMoney(app.mrrCents)}
      </div>

      <div className="w-16 shrink-0 text-right">
        <GrowthPill value={app.growth30d} />
      </div>
    </Link>
  )
}

/** Column keys for the row above. Rendered once at the top of a table. */
export function AppRowHeader({ withRank = true }: { withRank?: boolean }) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-3 py-2 sm:gap-4 sm:px-4">
      {withRank && <span className="label w-6 text-center">#</span>}
      <span className="label w-9 shrink-0" />
      <span className="label flex-1">App</span>
      <span className="label hidden w-40 shrink-0 lg:block">Founder</span>
      <span className="label w-24 shrink-0 text-right sm:w-28">MRR</span>
      <span className="label w-16 shrink-0 text-right">MoM</span>
    </div>
  )
}
