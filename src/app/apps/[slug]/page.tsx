import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Star } from 'lucide-react'
import { AdRail } from '@/components/ad-rail'
import { AppIcon } from '@/components/app-icon'
import { GrowthPill } from '@/components/growth-pill'
import { RevenueChart } from '@/components/revenue-chart'
import { AppScreenshots } from '@/components/app-screenshots'
import { AppReviews } from '@/components/app-reviews'
import { AsoScore } from '@/components/aso-score'
import { AddAppCta } from '@/components/add-app-cta'
import { AppCard } from '@/components/app-card'
import { VerifiedBadge, providerLabel } from '@/components/verified-badge'
import { ShareButton } from '@/components/share-button'
import { ExpandableText } from '@/components/expandable-text'
import { VibecodeVerdict } from '@/components/vibecode-verdict'
import { getAppBySlug, getAppReviews, getRevenueHistory, listApps } from '@/lib/data/apps'
import { listActiveSponsors } from '@/lib/data/purchases'
import { getVerdict } from '@/lib/data/vibecode'
import { getSponsorSlots, SETTING_LIMITS } from '@/lib/settings'
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

  const { app, metadata, metrics, category, founder } = record

  /*
   * One batch, not four awaits in a row. Only the lookup above has to happen
   * first — everything here needs the app id or its category, and nothing needs
   * anything else in the list. Run serially they cost four round trips to a
   * database in another country; run together they cost one.
   */
  const [history, reviews, verdict, relatedAll, totalSpots, allSponsors] = await Promise.all([
    getRevenueHistory(app.id, 365),
    getAppReviews(app.id),
    // Read from cache only. An app with no verdict simply does not show the
    // section, rather than blocking the page on a model call.
    getVerdict(app.id),
    // Same category where we have one, otherwise the top apps overall.
    listApps({ categorySlug: category?.slug, sort: 'mrr', limit: 7 }),
    getSponsorSlots(),
    listActiveSponsors(SETTING_LIMITS.sponsor_slots.max),
  ])

  const related = relatedAll.filter((item) => item.slug !== app.slug)
  const providers = metrics?.providers ?? []
  const mrrCents = Number(metrics?.mrrCents ?? 0)

  /*
   * Sponsors for the rails. `spotsLeft` is counted before removing this app, so
   * the "advertise here" placeholder reports real unsold inventory rather than
   * inventing a free spot on whichever page you happen to be reading.
   */
  const booked = allSponsors.slice(0, totalSpots)
  const spotsLeft = Math.max(0, totalSpots - booked.length)
  // An app does not advertise to the person already reading its page.
  const sponsors = booked.filter((sponsor) => sponsor.slug !== app.slug)

  return (
    <>
      <AdRail side="left" sponsors={sponsors} spotsLeft={spotsLeft} totalSpots={totalSpots} />
      <AdRail side="right" sponsors={sponsors} spotsLeft={spotsLeft} totalSpots={totalSpots} />

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
              <span className="ml-auto">
                <ShareButton
                  url={`${site.url}/apps/${app.slug}`}
                  title={app.name}
                  mrr={mrrCents > 0 ? formatMoney(mrrCents) : undefined}
                />
              </span>
            </div>
            {app.tagline && <p className="text-muted mt-2 text-lg">{app.tagline}</p>}

            <div className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {founder && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-dim">by</span>
                  <Link href={`/founders/${founder.handle}`} className="hover:text-blue">
                    {founder.name ?? `@${founder.handle}`}
                  </Link>
                  {founder.twitter && (
                    <a
                      href={`https://x.com/${founder.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-fg inline-flex items-center gap-1 text-xs transition-colors"
                      title={`@${founder.twitter} on X`}
                    >
                      <XMark />
                      {founder.twitterFollowers != null && (
                        <span className="tabular">{formatCount(founder.twitterFollowers)}</span>
                      )}
                    </a>
                  )}
                </span>
              )}
              {/*
                `!= null`, not a truthiness check: an app Apple has rated 0, or
                one nobody has reviewed yet, is still an app with a rating we
                know — and `0 &&` renders a bare 0 next to the byline rather
                than nothing at all.
              */}
              {metadata?.averageRating != null && (
                <span className="inline-flex items-center gap-1">
                  <Star className="fill-gold text-gold size-3.5" />
                  <span className="tabular">{metadata.averageRating.toFixed(1)}</span>
                  {/*
                    Hidden at zero. "(0)" beside a rating reads as a count that
                    failed to load; no count reads as what it is — nobody has
                    reviewed this yet.
                  */}
                  {metadata.ratingCount ? (
                    <span className="text-xs">({formatCount(metadata.ratingCount)})</span>
                  ) : null}
                </span>
              )}
              {app.website && (
                <a
                  href={app.website}
                  target="_blank"
                  /*
                   * Nofollow unless the founder paid for the upgrade. Passing
                   * authority to every listing by default would make the link
                   * worthless to sell and would make this site a link farm.
                   */
                  rel={app.websiteDofollow ? 'noopener noreferrer' : 'nofollow noopener noreferrer'}
                  className="hover:text-blue inline-flex items-center gap-1"
                >
                  Website
                  <ExternalLink className="size-3" />
                </a>
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

        {/* Headline figures, one card each, ahead of the chart. */}
        <dl className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="MRR" value={formatMoney(mrrCents)} suffix="/mo">
            <div className="mt-2 flex items-center gap-2">
              <GrowthPill value={metrics?.growth30d ?? null} />
              <span className="text-muted text-[11px]">vs. 30 days ago</span>
            </div>
          </StatCard>
          <StatCard label="ARR" value={formatMrr(Number(metrics?.arrCents ?? 0))}>
            <p className="text-muted mt-2 text-[11px]">Annualised run rate</p>
          </StatCard>
          <StatCard
            label="Subscribers"
            value={metrics?.activeSubscriptions ? formatCount(metrics.activeSubscriptions) : '—'}
          >
            <p className="text-muted mt-2 text-[11px]">
              {metrics?.activeSubscriptions ? 'Active subscriptions' : 'Not reported by provider'}
            </p>
          </StatCard>
          <StatCard label="90-day change" value={growthLabel(metrics?.growth90d)}>
            <p className="text-muted mt-2 text-[11px]">
              {metrics?.growth90d == null ? 'Needs 90 days of history' : 'vs. 90 days ago'}
            </p>
          </StatCard>
        </dl>

        {/* Revenue — the reason anyone is on this page. */}
        <section className="border-border bg-surface mt-3 rounded-[10px] border p-5 sm:p-6">
          <div>
            <RevenueChart data={history} />
          </div>

          <p className="border-border text-muted mt-4 border-t pt-3 text-[11px] leading-relaxed">
            Read from {providers.map(providerLabel).join(' and ') || 'no connected provider'}{' '}
            {metrics?.dataAsOf && ` · data as of ${metrics.dataAsOf}`}
            {metrics?.updatedAt && ` · last synced ${timeAgo(metrics.updatedAt)}`}
          </p>
        </section>

        {/* Apple's own screenshots straight after the revenue they belong to. */}
        <AppScreenshots urls={metadata?.screenshotUrls ?? []} appName={app.name} />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {app.description && (
              <section>
                <h2 className="display text-xl font-semibold">About</h2>
                <div className="mt-3">
                  <ExpandableText text={app.description} />
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <Panel title="App Store">
              <Row label="Category" value={category?.name ?? metadata?.primaryGenre ?? '—'} />{' '}
              <Row label="Version" value={metadata?.version ?? '—'} />{' '}
              {/*
              "Download", not "Price": this is what the App Store charges to
              install, which for a subscription app is almost always zero. The
              revenue above is the price that matters, and conflating the two
              is what makes "Free" look wrong on an app earning thousands.
            */}
              <Row label="Download" value={priceLabel(metadata?.priceCents, metadata?.currency)} />
              <Row
                label="Released"
                value={app.launchedAt ?? metadata?.releasedAt?.toISOString().slice(0, 10) ?? '—'}
              />
              <Row
                label="Requires"
                value={metadata?.minimumOsVersion ? `iOS ${metadata.minimumOsVersion}+` : '—'}
              />
              <Row label="Size" value={fileSizeLabel(metadata?.fileSizeBytes)} />
              <Row label="Age rating" value={metadata?.contentRating ?? '—'} />
            </Panel>

            {/*
              Only once the metadata sync has scored the listing. An app added
              minutes ago shows no panel rather than a zero it has not earned.
            */}
            {metadata?.asoScore != null && metadata.asoSignals && (
              <AsoScore
                total={metadata.asoScore}
                signals={metadata.asoSignals}
                fetchedAt={metadata.fetchedAt}
              />
            )}
          </aside>
        </div>

        <AppReviews
          reviews={reviews}
          histogram={metadata?.ratingHistogram}
          average={metadata?.averageRating}
          total={metadata?.ratingCount}
          appStoreUrl={app.appStoreUrl}
        />

        {verdict && (
          <VibecodeVerdict
            verdict={verdict.verdict}
            headline={verdict.headline}
            reasoning={verdict.reasoning}
            rebuildable={verdict.rebuildable}
            moat={verdict.moat}
            model={verdict.model}
          />
        )}

        {related.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="display text-xl font-semibold">
                {category?.name ? `More ${category.name} apps` : 'More apps'}
              </h2>
              <Link
                href={category?.slug ? `/categories/${category.slug}` : '/apps'}
                className="text-muted hover:text-fg text-[13px] transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {related.slice(0, 6).map((item) => (
                <AppCard key={item.slug} app={item} />
              ))}
            </div>
          </section>
        )}

        <AddAppCta />
      </div>
    </>
  )
}

function growthLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'

  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

/**
 * Apple reports bytes and displays megabytes on the decimal scale — 76,375,040
 * bytes is shown as 76.4 MB, not the 72.8 MiB a binary divisor would give. Match
 * the store so the two numbers agree.
 */
function fileSizeLabel(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return '—'
  const mb = Number(bytes) / 1_000_000
  if (mb >= 1000) return `${(mb / 1000).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function priceLabel(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents === null || cents === undefined) return '—'
  return cents === 0 ? 'Free' : formatMoney(cents, currency ?? 'USD')
}

function StatCard({
  label,
  value,
  suffix,
  children,
}: {
  label: string
  value: string
  suffix?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border-border bg-surface rounded-[10px] border p-4 sm:p-5">
      <dt className="label">{label}</dt>
      <dd>
        <p className="tabular text-fg mt-2 text-2xl font-semibold tracking-tight">
          {value}
          {suffix && <span className="text-muted text-sm font-normal">{suffix}</span>}
        </p>
        {children}
      </dd>
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

/** lucide dropped brand marks, so the X logo lives here. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  )
}
