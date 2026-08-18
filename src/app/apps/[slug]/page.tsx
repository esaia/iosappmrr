import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Star } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { GrowthPill } from '@/components/growth-pill'
import { RevenueChart } from '@/components/revenue-chart'
import { VerifiedBadge, providerLabel } from '@/components/verified-badge'
import { Badge } from '@/components/ui/badge'
import { getAppBySlug, getRevenueHistory } from '@/lib/data/apps'
import { formatCount, formatMoney, formatMrr, timeAgo } from '@/lib/utils'
import { site } from '@/lib/site'

export const revalidate = 600

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const record = await getAppBySlug(slug)
  if (!record) return { title: 'App not found' }

  const mrr = record.metrics ? formatMrr(Number(record.metrics.mrrCents)) : null
  const title = mrr ? `${record.app.name} — ${mrr}/mo verified MRR` : record.app.name

  return {
    title,
    description:
      record.app.tagline ??
      `Verified monthly revenue for ${record.app.name}, read directly from its payment provider.`,
    alternates: { canonical: `/apps/${slug}` },
    openGraph: { title, description: record.app.tagline ?? undefined },
  }
}

export default async function AppPage({ params }: Params) {
  const { slug } = await params
  const record = await getAppBySlug(slug)
  if (!record) notFound()

  const { app, metadata, metrics, category, founder, tech } = record
  const history = await getRevenueHistory(app.id)
  const providers = metrics?.providers ?? []
  const mrrCents = Number(metrics?.mrrCents ?? 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Search engines get the same facts the page shows. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: app.name,
            description: app.tagline ?? app.description ?? undefined,
            applicationCategory: category?.name,
            operatingSystem: 'iOS',
            url: `${site.url}/apps/${app.slug}`,
            image: metadata?.iconUrl ?? undefined,
            aggregateRating: metadata?.averageRating
              ? {
                  '@type': 'AggregateRating',
                  ratingValue: metadata.averageRating,
                  ratingCount: metadata.ratingCount ?? undefined,
                }
              : undefined,
          }),
        }}
      />

      <nav className="text-muted mb-6 text-xs">
        <Link href="/apps" className="hover:text-fg">
          Apps
        </Link>
        {category && (
          <>
            {' / '}{' '}
            <Link href={`/categories/${category.slug}`} className="hover:text-fg">
              {category.name}
            </Link>
          </>
        )}
      </nav>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <AppIcon src={metadata?.iconUrl} name={app.name} size={88} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display text-3xl font-semibold sm:text-4xl">{app.name}</h1>
            <VerifiedBadge providers={providers} />
          </div>
          {app.tagline && <p className="text-muted mt-2 text-lg">{app.tagline}</p>}

          <div className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {founder && (
              <Link href={`/founders/${founder.handle}`} className="hover:text-blue">
                {founder.name ?? `@${founder.handle}`}
              </Link>
            )}
            {metadata?.averageRating && (
              <span className="inline-flex items-center gap-1">
                <Star className="fill-gold text-gold size-3.5" />
                <span className="tabular">{metadata.averageRating.toFixed(1)}</span>
                {metadata.ratingCount && (
                  <span className="text-xs">({formatCount(metadata.ratingCount)})</span>
                )}
              </span>
            )}
            {app.appStoreUrl && (
              <a
                href={app.appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue inline-flex items-center gap-1"
              >
                App Store
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Revenue — the reason anyone is on this page. */}
      <section className="border-border bg-surface mt-10 rounded-[10px] border p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="label">Verified monthly recurring revenue</h2>
            <p className="display tabular mt-1.5 text-4xl font-semibold sm:text-5xl">
              {formatMoney(mrrCents)}
              <span className="text-muted text-lg font-normal">/mo</span>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <GrowthPill value={metrics?.growth30d ?? null} />
              <span className="text-muted text-xs">vs. 30 days ago</span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <Figure label="ARR" value={formatMrr(Number(metrics?.arrCents ?? 0))} />
            <Figure
              label="Subscribers"
              value={metrics?.activeSubscriptions ? formatCount(metrics.activeSubscriptions) : '—'}
            />
            <Figure label="90-day change" value={growthLabel(metrics?.growth90d)} />
          </dl>
        </div>

        <div className="mt-6">
          <RevenueChart data={history} />
        </div>

        <p className="border-border text-muted mt-4 border-t pt-3 text-[11px] leading-relaxed">
          Read from {providers.map(providerLabel).join(' and ') || 'no connected provider'}{' '}
          {metrics?.dataAsOf && ` · data as of ${metrics.dataAsOf}`}
          {metrics?.updatedAt && ` · last synced ${timeAgo(metrics.updatedAt)}`}
        </p>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {app.description && (
            <section>
              <h2 className="display text-xl font-semibold">About</h2>
              <p className="text-muted mt-3 leading-relaxed">{app.description}</p>
            </section>
          )}

          {metadata?.screenshotUrls && metadata.screenshotUrls.length > 0 && (
            <section className="mt-8">
              <h2 className="display text-xl font-semibold">Screenshots</h2>
              <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {metadata.screenshotUrls.slice(0, 6).map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    loading="lazy"
                    className="border-border h-72 w-auto shrink-0 rounded-[10px] border"
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="App Store">
            <Row label="Category" value={category?.name ?? metadata?.primaryGenre ?? '—'} />{' '}
            <Row label="Version" value={metadata?.version ?? '—'} />{' '}
            <Row label="Price" value={priceLabel(metadata?.priceCents, metadata?.currency)} />
            <Row
              label="Released"
              value={app.launchedAt ?? metadata?.releasedAt?.toISOString().slice(0, 10) ?? '—'}
            />
            <Row
              label="Requires"
              value={metadata?.minimumOsVersion ? `iOS ${metadata.minimumOsVersion}+` : '—'}
            />{' '}
          </Panel>

          {tech.length > 0 && (
            <Panel title="Built with">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tech.map((tag) => (
                  <Link key={tag.slug} href={`/apps?tech=${tag.slug}`}>
                    <Badge tone="outline" className="hover:border-border-strong hover:text-fg">
                      {tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  )
}

function growthLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'

  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function priceLabel(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents === null || cents === undefined) return '—'
  return cents === 0 ? 'Free' : formatMoney(cents, currency ?? 'USD')
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular text-fg mt-0.5 text-base font-medium">{value}</dd>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-surface rounded-[10px] border p-5">
      <h2 className="label">{title}</h2>
      <dl className="mt-3 space-y-2">{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular text-fg truncate">{value}</dd>
    </div>
  )
}
