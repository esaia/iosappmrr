import type { Metadata } from 'next'
import Link from 'next/link'
import { getEcosystemStats, listCategories, listTechTags } from '@/lib/data/apps'
import { formatMoney, formatMrr } from '@/lib/utils'
import { Container } from '@/components/ui/container'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'iOS ecosystem stats',
  description:
    'Aggregate verified revenue across indexed App Store apps: totals by category, median MRR, and which stacks the earning apps are built on.',
}

export default async function StatsPage() {
  const [stats, categories, tech] = await Promise.all([
    getEcosystemStats(),
    listCategories(),
    listTechTags(),
  ])

  const ranked = categories
    .filter((category) => category.appCount > 0)
    .sort((a, b) => Number(b.totalMrrCents) - Number(a.totalMrrCents))

  const peak = Number(ranked[0]?.totalMrrCents ?? 1)

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="display text-4xl font-semibold sm:text-5xl">Stats</h1>
      <p className="text-muted mt-3 max-w-xl">
        Everything below counts verified revenue only — apps with a live provider connection. It is
        a floor for the indie iOS market, not an estimate of it.
      </p>

      <dl className="border-border mt-8 grid grid-cols-2 gap-6 border-y py-6 sm:grid-cols-4">
        <Stat label="Verified MRR" value={formatMoney(stats.totalMrrCents)} />
        <Stat label="Annualised" value={formatMrr(stats.totalMrrCents * 12)} />
        <Stat label="Apps" value={stats.appCount.toString()} />
        <Stat label="Founders" value={stats.founderCount.toString()} />
      </dl>

      <section className="mt-12">
        <h2 className="display text-2xl font-semibold">Revenue by category</h2>
        {/*
          A horizontal bar per category: one measure, one axis, sorted by value.
          Length carries the comparison, the number carries the precision.
        */}
        <ul className="mt-5 space-y-3">
          {ranked.map((category) => {
            const total = Number(category.totalMrrCents)
            return (
              <li key={category.slug}>
                <Link href={`/categories/${category.slug}`} className="group block">
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-fg group-hover:text-blue font-medium">
                      {category.name}
                    </span>
                    <span className="tabular text-fg shrink-0">
                      {formatMrr(total)}
                      <span className="text-muted">/mo</span>
                      <span className="text-muted ml-2 text-xs">
                        {category.appCount} {category.appCount === 1 ? 'app' : 'apps'}
                      </span>
                    </span>
                  </div>
                  <div className="bg-surface-2 mt-1.5 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-accent h-full rounded-full"
                      style={{ width: `${Math.max(1.5, (total / peak) * 100)}%` }}
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="display text-2xl font-semibold">What earning apps are built with</h2>
        <p className="text-muted mt-2 text-sm">
          Self-reported by founders, unlike revenue. Counted across verified apps.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {tech
            .filter((tag) => tag.appCount > 0)
            .map((tag) => (
              <li
                key={tag.slug}
                className="border-border bg-surface flex items-baseline justify-between gap-3 rounded-[10px] border px-4 py-2.5"
              >
                <Link href={`/apps?tech=${tag.slug}`} className="text-fg hover:text-blue text-sm">
                  {tag.name}
                </Link>
                <span className="tabular text-muted text-xs">{tag.appCount}</span>
              </li>
            ))}
        </ul>
      </section>

      <p className="text-muted mt-12 text-xs">
        Median app earns {formatMrr(stats.medianMrrCents)}/mo. Figures refresh daily.
      </p>
    </Container>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="display tabular mt-1 text-2xl font-semibold sm:text-[28px]">{value}</dd>
    </div>
  )
}
