import type { Metadata } from 'next'
import Link from 'next/link'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { getEcosystemStats, listApps, type AppSort } from '@/lib/data/apps'
import { formatMoney, formatMrr } from '@/lib/utils'
import { site } from '@/lib/site'
import { Container } from '@/components/ui/container'
import { JsonLd } from '@/components/json-ld'
import { breadcrumbs, graph, itemList } from '@/lib/seo'

export const revalidate = 600

const SORTS: { value: AppSort; label: string; blurb: string }[] = [
  { value: 'mrr', label: 'Revenue', blurb: 'Highest verified MRR, largest first.' },
  { value: 'growth', label: 'Growth', blurb: 'Biggest MRR increase over the last 30 days.' },
  { value: 'newest', label: 'Newest', blurb: 'Most recently verified apps.' },
]
/**
 * `?sort=` reorders the same hundred apps, so every variant canonicalises to the
 * bare path: three URLs holding one set of rows is the textbook duplicate, and
 * pointing them at one another's ranking signal is the whole reason to bother.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const sort = SORTS.find((s) => s.value === params.sort)

  return {
    title:
      sort && sort.value !== 'mrr'
        ? `Top 100 iOS apps by ${sort.label.toLowerCase()}`
        : 'Top 100 iOS apps by verified revenue',
    description:
      'The hundred highest-earning App Store apps whose revenue is read directly from their payment provider. Updated daily.',
    alternates: { canonical: '/leaderboard' },
  }
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const params = await searchParams
  const sort = (SORTS.find((s) => s.value === params.sort)?.value ?? 'mrr') as AppSort
  const [apps, stats] = await Promise.all([listApps({ sort, limit: 100 }), getEcosystemStats()])
  const active = SORTS.find((s) => s.value === sort)!

  return (
    <Container className="py-10 sm:py-14">
      <JsonLd
        data={graph(
          itemList(apps.map((app) => ({ slug: app.slug, name: app.name }))),
          breadcrumbs([{ name: 'Top 100', path: '/leaderboard' }]),
        )}
      />

      <header>
        <p className="label">Updated daily</p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">Top 100</h1>
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
        <div className="border-border bg-surface rounded-card mt-6 overflow-hidden border">
          <AppRowHeader />
          {apps.map((app, index) => (
            <AppRow key={app.id} app={app} rank={index + 1} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted rounded-card mt-10 border border-dashed p-10 text-center">
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
    </Container>
  )
}
