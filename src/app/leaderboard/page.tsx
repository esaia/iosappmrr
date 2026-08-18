import type { Metadata } from 'next'
import Link from 'next/link'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { getEcosystemStats, listApps, type AppSort } from '@/lib/data/apps'
import { formatMoney, formatMrr } from '@/lib/utils'
import { site } from '@/lib/site'

export const revalidate = 600

const SORTS: { value: AppSort; label: string; blurb: string }[] = [
  { value: 'mrr', label: 'Revenue', blurb: 'Highest verified MRR, largest first.' },
  { value: 'growth', label: 'Growth', blurb: 'Biggest MRR increase over the last 30 days.' },
  { value: 'newest', label: 'Newest', blurb: 'Most recently verified apps.' },
]
export const metadata: Metadata = {
  title: 'Top 50 iOS apps by verified revenue',
  description:
    'The fifty highest-earning App Store apps whose revenue is read directly from their payment provider. Updated hourly.',
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const params = await searchParams
  const sort = (SORTS.find((s) => s.value === params.sort)?.value ?? 'mrr') as AppSort
  const [apps, stats] = await Promise.all([listApps({ sort, limit: 50 }), getEcosystemStats()])
  const active = SORTS.find((s) => s.value === sort)!

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="label">Updated hourly</p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">Top 50</h1>
        <p className="text-muted mt-3 max-w-xl">
          Every app below has connected a payment provider. {formatMoney(stats.totalMrrCents)} of
          monthly revenue across {stats.appCount} apps, none of it typed in by hand.
        </p>
      </header>

      <nav className="mt-8 flex flex-wrap items-center gap-2" aria-label="Sort leaderboard">
        {SORTS.map((option) => (
          <Link
            key={option.value}
            href={option.value === 'mrr' ? '/leaderboard' : `/leaderboard?sort=${option.value}`}
            aria-current={option.value === sort ? 'page' : undefined}
            className={
              option.value === sort
                ? 'bg-accent text-accent-fg rounded-lg px-3 py-1.5 text-sm font-medium'
                : 'border-border text-muted hover:border-border-strong hover:text-fg rounded-lg border px-3 py-1.5 text-sm transition-colors'
            }
          >
            {option.label}
          </Link>
        ))}
        <p className="text-muted w-full text-[13px] sm:w-auto sm:pl-2">{active.blurb}</p>
      </nav>

      {apps.length > 0 && (
        <div className="border-border bg-surface mt-6 overflow-hidden rounded-[10px] border">
          <AppRowHeader />
          {apps.map((app, index) => (
            <AppRow key={app.id} app={app} rank={index + 1} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted mt-10 rounded-[10px] border border-dashed p-10 text-center">
          No verified apps yet.{' '}
          <Link href="/submit" className="text-blue underline-offset-4 hover:underline">
            Be the first
          </Link>
          .
        </p>
      )}

      <p className="text-muted mt-8 text-xs">
        Median MRR across the index: {formatMrr(stats.medianMrrCents)}/mo · {site.name}
      </p>
    </div>
  )
}
