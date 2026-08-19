import type { Metadata } from 'next'
import Link from 'next/link'
import { AdRail } from '@/components/ad-rail'
import { AppRail } from '@/components/app-card'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { HomeSearch } from '@/components/home-search'
import { CategoryPills } from '@/components/category-pills'
import { listApps, listCategories } from '@/lib/data/apps'
import { listActiveSponsors } from '@/lib/data/purchases'
import { getSponsorSlots, SETTING_LIMITS } from '@/lib/settings'
import { Container } from '@/components/ui/container'
import { JsonLd } from '@/components/json-ld'
import { graph, itemList, organization, website } from '@/lib/seo'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export const revalidate = 600

const QUICK_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/stats', label: 'Stats' },
  { href: '/verification', label: 'How we verify' },
  { href: '/dashboard', label: 'Dashboard' },
]

export default async function HomePage() {
  /*
   * The slot count is fetched alongside the sponsors rather than before them.
   * Awaiting it first to use as the query's limit read naturally but cost an
   * extra serial round trip on the site's most visited page — and the database
   * is far enough away for that to be most of a second. Fetching at the highest
   * count an admin could ever set and trimming here is one round trip cheaper,
   * and the list is at most a few dozen rows.
   */
  const [totalSpots, top, recent, categories, allSponsors] = await Promise.all([
    getSponsorSlots(),
    listApps({ sort: 'mrr', limit: 100 }),
    listApps({ sort: 'newest', limit: 8 }),
    listCategories(),
    listActiveSponsors(SETTING_LIMITS.sponsor_slots.max),
  ])

  const sponsors = allSponsors.slice(0, totalSpots)
  const spotsLeft = Math.max(0, totalSpots - sponsors.length)

  return (
    <>
      {/* The site-level graph lives on the home page only; inner pages describe
          themselves and point back at it by @id. */}
      <JsonLd
        data={graph(
          organization(),
          website(),
          // The same ranking the page renders below, in the same order.
          itemList(top.slice(0, 20).map((app) => ({ slug: app.slug, name: app.name }))),
        )}
      />
      <AdRail side="left" sponsors={sponsors} spotsLeft={spotsLeft} totalSpots={totalSpots} />
      <AdRail side="right" sponsors={sponsors} spotsLeft={spotsLeft} totalSpots={totalSpots} />

      <Container className="pb-4">
        {/* Hero */}
        <section className="pt-12 text-center sm:pt-16">
          <h1 className="display mx-auto max-w-4xl text-[clamp(1.9rem,5.2vw,3.5rem)] text-balance">
            The database of verified iOS app revenue
          </h1>
          <p className="text-muted mx-auto mt-5 max-w-xl text-[13px] leading-relaxed">
            See what iOS apps really earn — or connect your own and prove yours. One read-only key,
            refreshed daily.{' '}
            <Link
              href="/verification"
              className="text-blue hover:text-fg decoration-blue/30 underline underline-offset-4 transition-colors"
            >
              See how we verify
            </Link>
          </p>

          <HomeSearch />

          <nav className="text-muted mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px]">
            {QUICK_LINKS.map((link, index) => (
              <span key={link.href} className="flex items-center gap-2">
                {index > 0 && <span className="text-dim">·</span>}
                <Link href={link.href} className="hover:text-fg">
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </section>

        <AppRail
          title="Recently verified"
          href="/apps?sort=newest"
          linkLabel="View all"
          apps={recent}
        />

        {/* Leaderboard panel */}
        <section className="glass border-border rounded-card mt-10 overflow-hidden border">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
            <h2 className="text-fg text-[15px] font-bold">Top 100 by MRR</h2>
            <div className="text-muted flex items-center gap-2.5 text-[12px]">
              <span className="rounded-md bg-white/8 px-2 py-1 ring-1 ring-white/10 ring-inset">
                MRR
              </span>
              <Link href="/leaderboard" className="hover:text-fg">
                Open full leaderboard →
              </Link>
            </div>
          </div>

          <AppRowHeader />
          {top.map((app, index) => (
            <AppRow key={app.id} app={app} rank={index + 1} />
          ))}
        </section>

        <CategoryPills categories={categories.filter((category) => category.appCount > 0)} />

        {/* How verification works */}
        <section className="glass border-border rounded-card mt-10 border p-5 sm:p-7">
          <h2 className="text-fg text-[15px] font-bold">What &ldquo;verified&rdquo; means here</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <Explainer
              index="01"
              title="Read-only, scoped keys"
              body="Founders connect a key that can read revenue charts and nothing else. It cannot see customers, issue refunds, or change a paywall."
            />
            <Explainer
              index="02"
              title="Refreshed every day"
              body="A number that was true last quarter is not verification. Every connected app is re-read daily, and each profile shows its last sync."
            />
            <Explainer
              index="03"
              title="Credentials stay encrypted"
              body="Keys are encrypted before they touch the database and are never returned to a browser — not even to the founder who added them."
            />
          </div>
          <Link
            href="/verification"
            className="text-blue hover:text-fg decoration-blue/30 mt-5 inline-block text-[12px] underline underline-offset-4 transition-colors"
          >
            Read the full method →
          </Link>
        </section>
      </Container>
    </>
  )
}

/**
 * Numbered because verification really is a sequence — the key is connected,
 * then read on a schedule, and encrypted throughout.
 */
function Explainer({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div>
      <p className="label">{index}</p>
      <h3 className="text-fg mt-1.5 text-[13px] font-bold">{title}</h3>
      <p className="text-muted mt-1.5 text-[12px] leading-relaxed">{body}</p>
    </div>
  )
}
