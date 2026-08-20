import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Star } from 'lucide-react'
import { AdRail } from '@/components/ad-rail'
import { AppIcon } from '@/components/app-icon'
import { AnonymousName } from '@/components/anonymous-name'
import { FounderAvatar } from '@/components/founder-avatar'
import { AppleMark } from '@/components/apple-mark'
import { GrowthPill } from '@/components/growth-pill'
import { InfoTip } from '@/components/info-tip'
import { RevenueChart } from '@/components/revenue-chart'
import { AppScreenshots } from '@/components/app-screenshots'
import { AppReviews } from '@/components/app-reviews'
import { AsoScore } from '@/components/aso-score'
import { AddAppCta } from '@/components/add-app-cta'
import { AppCard } from '@/components/app-card'
import { VerifiedBadge, providerLabel } from '@/components/verified-badge'
import { ShareButton } from '@/components/share-dialog'
import { ExpandableText } from '@/components/expandable-text'
import { VibecodeVerdict } from '@/components/vibecode-verdict'
import { TechIcon } from '@/components/tech-icon'
import { getCurrentUser } from '@/lib/auth'
import { getAppBySlug, getAppReviews, getRevenueHistory, listApps } from '@/lib/data/apps'
import { listActiveSponsors } from '@/lib/data/purchases'
import { getVerdict } from '@/lib/data/vibecode'
import { getSponsorSlots, SETTING_LIMITS } from '@/lib/settings'
import { formatCount, formatMoney, formatMrr, timeAgo } from '@/lib/utils'
import { site } from '@/lib/site'
import { Container } from '@/components/ui/container'
import { JsonLd } from '@/components/json-ld'
import { breadcrumbs, graph, mobileApplication } from '@/lib/seo'

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
  /*
   * Who is reading, alongside the app itself. The header already asks for the
   * session on every route, so this costs nothing extra — `getCurrentUser` is
   * cached per request — but it decides how much history the page is allowed to
   * send, so it has to be answered before the fetch below.
   */
  const [record, viewer] = await Promise.all([getAppBySlug(slug), getCurrentUser()])
  if (!record) notFound()

  const signedIn = viewer != null

  const { app, metadata, metrics, category, founder, tech } = record

  /*
   * One batch, not four awaits in a row. Only the lookup above has to happen
   * first — everything here needs the app id or its category, and nothing needs
   * anything else in the list. Run serially they cost four round trips to a
   * database in another country; run together they cost one.
   */
  const [history, reviews, verdict, relatedAll, totalSpots, allSponsors] = await Promise.all([
    /*
     * A signed-out reader gets the last 30 days, and gets them as data rather
     * than as a locked control over a full year already sitting in the page
     * source — a gate drawn in the client is not a gate. Sixty, not thirty:
     * "compare previous period" needs the window before the one on screen, and
     * that comparison is part of what the free view offers.
     */
    getRevenueHistory(app.id, signedIn ? 365 : 60),
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
  // Matches what AppReviews itself renders: no reviews and no histogram, no section.
  // Reviews are quoted from the store listing and link back to it, so they say
  // which app this is even when nothing else on the page does.
  const hasReviews = !app.isAnonymous && (reviews.length > 0 || Boolean(metadata?.ratingHistogram))
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

      <Container className="py-10 sm:py-14">
        {/* Search engines get the same facts the page shows, and no others. */}
        <JsonLd
          data={graph(
            mobileApplication({
              slug: app.slug,
              name: app.name,
              tagline: app.tagline,
              description: app.description,
              appStoreUrl: app.appStoreUrl,
              iconUrl: metadata?.iconUrl ?? null,
              screenshotUrls: metadata?.screenshotUrls ?? [],
              priceCents: metadata?.priceCents ?? null,
              currency: metadata?.currency ?? null,
              // Passed through as-is: the header below renders the rating on
              // exactly the same condition, so the markup can never claim one
              // the page does not show.
              averageRating: metadata?.averageRating ?? null,
              ratingCount: metadata?.ratingCount ?? null,
              primaryGenre: category?.name ?? metadata?.primaryGenre ?? null,
              releasedAt: metadata?.releasedAt ?? null,
              founder: founder ? { name: founder.name, handle: founder.handle } : null,
            }),
            // Mirrors the breadcrumb nav immediately below.
            breadcrumbs([
              { name: 'Apps', path: '/apps' },
              ...(category ? [{ name: category.name, path: `/categories/${category.slug}` }] : []),
              { name: app.name, path: `/apps/${app.slug}` },
            ]),
          )}
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

        {/*
          One card, not three.

          The masthead, the headline figures and the chart are all one claim —
          this app earns this much, and here is how it got there — so they share
          a frame with hairlines between them rather than floating as three
          panels with strips of page ground in between. The gaps were doing no
          work except pushing the chart, which is what anyone came for, further
          down the page.
        */}
        <section className="border-border glass-panel rounded-card border">
          <header className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-7">
            <AppIcon src={metadata?.iconUrl} name={app.name} size={88} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="display text-2xl font-semibold sm:text-3xl">
                  {app.isAnonymous ? <AnonymousName tooltip>{app.name}</AnonymousName> : app.name}
                </h1>
                <VerifiedBadge providers={providers} />
                <span className="ml-auto">
                  <ShareButton
                    slug={app.slug}
                    url={`${site.url}/apps/${app.slug}`}
                    name={app.name}
                    mrr={mrrCents > 0 ? formatMoney(mrrCents) : undefined}
                    // A line needs two points; below that the dialog offers the
                    // badge alone rather than a chart with nothing in it.
                    hasHistory={history.length >= 2}
                  />
                </span>
              </div>
              {app.tagline && (
                <p className="text-muted mt-2 text-base">
                  {app.isAnonymous ? (
                    <AnonymousName block>{app.tagline}</AnonymousName>
                  ) : (
                    app.tagline
                  )}
                </p>
              )}

              <div className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {/* The founder has a cell of their own in the grid below. */}
                {/*
                  `!= null`, not a truthiness check: an app Apple has rated 0, or
                  one nobody has reviewed yet, is still an app with a rating we
                  know — and `0 &&` renders a bare 0 next to the byline rather
                  than nothing at all.
                */}
                {metadata?.averageRating != null && (
                  <Rating
                    average={metadata.averageRating}
                    count={metadata.ratingCount}
                    appStoreUrl={app.appStoreUrl}
                  />
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
                    rel={
                      app.websiteDofollow ? 'noopener noreferrer' : 'nofollow noopener noreferrer'
                    }
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
                    <AppleMark />
                    App Store
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </header>

          {/*
            Headline figures on a hairline grid rather than in cards of their
            own. Four bordered boxes inside a bordered box is a border too many;
            the rules alone separate them, and the figures line up across the
            width of the card the way a table's would.
          */}
          <dl className="border-border grid grid-cols-2 border-t lg:grid-cols-4">
            <StatCell
              label="MRR"
              value={formatMoney(mrrCents)}
              suffix="/mo"
              note="Monthly recurring revenue from currently active subscriptions, not the last 30 days of sales."
            >
              <GrowthPill value={metrics?.growth30d ?? null} />
              <span>vs. 30 days ago</span>
            </StatCell>
            <StatCell
              label="ARR"
              value={formatMrr(Number(metrics?.arrCents ?? 0))}
              note="MRR multiplied by twelve — what the app earns over a year if today's subscriptions simply keep renewing. A projection, not money taken."
              align="end"
            >
              <span>Annualised run rate</span>
            </StatCell>
            <StatCell
              label="Subscribers"
              value={metrics?.activeSubscriptions ? formatCount(metrics.activeSubscriptions) : '—'}
              note="Paying subscriptions active right now, straight from the connected provider. Free trials are not counted until they convert."
            >
              <span>
                {metrics?.activeSubscriptions ? 'Active subscriptions' : 'Not reported by provider'}
              </span>
            </StatCell>
            {/*
              A person, in the last cell, rather than a fourth figure.

              The other three cells are the app; this one is who is behind it,
              which on a site built on verified revenue is the fact a reader
              most wants next — and it reads far better here, at the size of a
              headline, than it did as a grey byline under the tagline.
            */}
            <FounderCell founder={founder} />
          </dl>

          {/* Revenue — the reason anyone is on this page. */}
          <div className="border-border border-t p-5 sm:p-6">
            <RevenueChart data={history} signedIn={signedIn} />

            <p className="border-border text-dim mt-5 border-t pt-3 text-[11px] leading-relaxed">
              Read from {providers.map(providerLabel).join(' and ') || 'no connected provider'}{' '}
              {metrics?.dataAsOf && ` · data as of ${metrics.dataAsOf}`}
              {metrics?.updatedAt && ` · last synced ${timeAgo(metrics.updatedAt)}`}
            </p>
          </div>
        </section>

        {/* Apple's own screenshots straight after the revenue they belong to. */}
        <AppScreenshots urls={metadata?.screenshotUrls ?? []} appName={app.name} />

        {/*
          The facts panel and the ASO score run tall, so the reading column
          carries About and the reviews rather than a short paragraph and a
          column of dead space beside them.
        */}
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/*
            A new app with no ratings leaves only the description here, far
            shorter than the panels beside it, so it rides down with the scroll
            instead of sitting at the top of an empty column.
          */}
          <div className={hasReviews ? undefined : 'lg:sticky lg:top-20'}>
            {app.description && (
              <section>
                <h2 className="display text-xl font-semibold">About</h2>
                <div className="mt-3">
                  {/*
                    Not run through ExpandableText: there is nothing to expand,
                    and a "read more" on unreadable text is a broken promise.
                  */}
                  {app.isAnonymous ? (
                    <AnonymousName block className="text-muted text-sm leading-relaxed">
                      {app.description}
                    </AnonymousName>
                  ) : (
                    <ExpandableText text={app.description} />
                  )}
                </div>
              </section>
            )}

            <AppReviews
              reviews={reviews}
              histogram={metadata?.ratingHistogram}
              average={metadata?.averageRating}
              total={metadata?.ratingCount}
              appStoreUrl={app.appStoreUrl}
            />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-20">
            {/*
              The mark beside the words, naming where every figure in this
              panel came from. Never on its own and never near the verified
              badge — that badge is ours, and Apple has not vouched for it.
            */}
            <Panel
              title={
                <>
                  <AppleMark />
                  App Store
                </>
              }
            >
              <Row label="Category" value={category?.name ?? metadata?.primaryGenre ?? '—'} />
              <Row label="Version" value={metadata?.version ?? '—'} />
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
              The founder's own answer to "how was this built", which is the
              question the rest of the page cannot answer. Hidden when they have
              not said, rather than shown as an empty panel.
            */}
            {tech.length > 0 && (
              <section className="border-border glass-panel rounded-card overflow-hidden border">
                <h2 className="label border-border border-b px-4 py-3">Built with</h2>
                <div className="flex flex-wrap gap-1.5 p-4">
                  {tech.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/apps?tech=${tag.slug}`}
                      className="border-border text-muted hover:border-border-strong hover:text-fg inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors"
                    >
                      <TechIcon slug={tag.slug} />
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/*
              Only once the metadata sync has scored the listing. An app added
              minutes ago shows no panel rather than a zero it has not earned.
            */}
            {/*
              Scored from the store listing and quoting it back — the title, the
              subtitle, the opening line of the description. It names the app in
              the course of grading it, so a stealth listing does without.
            */}
            {metadata?.asoScore != null && metadata.asoSignals && !app.isAnonymous && (
              <AsoScore
                total={metadata.asoScore}
                signals={metadata.asoSignals}
                fetchedAt={metadata.fetchedAt}
              />
            )}
          </aside>
        </div>

        {/* Written about a named app, so it can name it. Withheld with the rest. */}
        {verdict && !app.isAnonymous && (
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
      </Container>
    </>
  )
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

/**
 * The store rating, linking to the reviews it is an average of.
 *
 * `see-all=reviews` is Apple's own deep link straight to the review list rather
 * than to the top of the listing, so a reader who clicks the figure lands on
 * the thing the figure summarises. Plain text where the app has no store URL,
 * rather than a link with nowhere to go.
 */
function Rating({
  average,
  count,
  appStoreUrl,
}: {
  average: number
  count: number | null | undefined
  appStoreUrl: string | null | undefined
}) {
  const figure = (
    <>
      <Star className="fill-gold text-gold size-3.5" />
      <span className="tabular">{average.toFixed(1)}</span>
      {/*
        Hidden at zero. "(0)" beside a rating reads as a count that failed to
        load; no count reads as what it is — nobody has reviewed this yet.
      */}
      {count ? <span className="text-xs">({formatCount(count)})</span> : null}
    </>
  )

  if (!appStoreUrl) return <span className="inline-flex items-center gap-1">{figure}</span>

  return (
    <a
      href={`${appStoreUrl}?see-all=reviews`}
      target="_blank"
      rel="noopener noreferrer"
      title="Read the reviews on the App Store"
      className="hover:text-fg inline-flex items-center gap-1 transition-colors"
    >
      {figure}
      <ExternalLink className="size-3" />
    </a>
  )
}

/**
 * The chrome every masthead cell shares.
 *
 * The dividing rules are the cell's own borders rather than a wrapper's, which
 * is what lets the grid reflow from four columns to two without the hairlines
 * landing in the wrong places: the right-hand rule is drawn on the odd cells,
 * so it always falls between a pair, and the bottom rule is dropped from the
 * last two cells, which are the final row at either width.
 */
const CELL =
  'border-border border-b p-4 odd:border-r sm:p-5 lg:border-r lg:border-b-0 lg:last:border-r-0 [&:nth-last-child(-n+2)]:border-b-0'

/** One headline figure in the masthead grid. */
function StatCell({
  label,
  value,
  suffix,
  note,
  align,
  children,
}: {
  label: string
  value: string
  suffix?: string
  /** What the figure counts, shown on the ⓘ beside the label. */
  note?: string
  align?: 'start' | 'end'
  children?: React.ReactNode
}) {
  return (
    <div className={CELL}>
      <dt className="label flex items-center gap-1.5">
        {label}
        {note && <InfoTip text={note} align={align} />}
      </dt>
      <dd>
        <p className="tabular text-fg mt-2.5 text-2xl font-semibold tracking-tight">
          {value}
          {suffix && <span className="text-dim text-sm font-normal">{suffix}</span>}
        </p>
        <div className="text-dim mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
          {children}
        </div>
      </dd>
    </div>
  )
}

const FOUNDER_NOTE =
  'The person who claimed this listing and connected the payment provider every figure above is read from.'

/**
 * The founder, in the same grid as the figures.
 *
 * A picture and a name where the other cells put a number, so the row reads as
 * four facts of equal weight rather than three facts and an afterthought. An
 * unclaimed listing keeps the cell and says so, rather than collapsing the grid
 * to three columns on some apps and four on others.
 */
function FounderCell({
  founder,
}: {
  founder: {
    handle: string
    name: string | null
    avatarUrl: string | null
    twitter: string | null
    twitterFollowers: number | null
  } | null
}) {
  if (!founder) {
    return (
      <div className={CELL}>
        <dt className="label flex items-center gap-1.5">
          Founder
          <InfoTip text={FOUNDER_NOTE} align="end" />
        </dt>
        <dd>
          <p className="text-dim mt-2.5 text-2xl font-semibold tracking-tight">—</p>
          <div className="text-dim mt-1.5 text-[11px]">Listing not claimed</div>
        </dd>
      </div>
    )
  }

  const name = founder.name ?? `@${founder.handle}`

  return (
    <div className={CELL}>
      <dt className="label flex items-center gap-1.5">
        Founder
        <InfoTip text={FOUNDER_NOTE} align="end" />
      </dt>
      <dd>
        <Link
          href={`/founders/${founder.handle}`}
          className="text-fg hover:text-blue mt-2.5 flex min-w-0 items-center gap-2.5 transition-colors"
        >
          <FounderAvatar avatarUrl={founder.avatarUrl} name={name} size={30} />
          <span className="truncate text-lg font-semibold tracking-tight">{name}</span>
        </Link>
        <div className="text-dim mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px]">
          {founder.twitter ? (
            <a
              href={`https://x.com/${founder.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-fg inline-flex items-center gap-1 transition-colors"
              title={`@${founder.twitter} on X`}
            >
              <XMark />
              <span>@{founder.twitter}</span>
              {founder.twitterFollowers != null && (
                <span className="tabular">· {formatCount(founder.twitterFollowers)}</span>
              )}
            </a>
          ) : (
            <span>@{founder.handle}</span>
          )}
        </div>
      </dd>
    </div>
  )
}

/**
 * A sidebar panel: a titled strip over a list of facts.
 *
 * The title used to float inside the padding with the rows beneath it, which
 * left it reading as the first row rather than as the heading of the set. On
 * its own bordered strip it belongs to the panel, and the rows below can then
 * be divided from each other — so a column of unrelated facts scans as a table
 * instead of as a paragraph of pairs.
 */
function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-border glass-panel rounded-card overflow-hidden border">
      <h2 className="label border-border flex items-center gap-1.5 border-b px-4 py-3">{title}</h2>
      <dl className="divide-border divide-y">{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-[13px]">
      <dt className="text-dim">{label}</dt>
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
