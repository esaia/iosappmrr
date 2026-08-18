import Link from 'next/link'
import { AdRail } from '@/components/ad-rail'
import { AppRail } from '@/components/app-card'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { HomeSearch } from '@/components/home-search'
import { CategoryPills } from '@/components/category-pills'
import { listApps, listCategories } from '@/lib/data/apps'
import { listActiveSponsors } from '@/lib/data/purchases'
import { TOTAL_SPOTS } from '@/lib/ads'

export const revalidate = 600

const QUICK_LINKS = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/stats', label: 'Stats' },
  { href: '/verification', label: 'How we verify' },
  { href: '/dashboard', label: 'Dashboard' },
]

export default async function HomePage() {
  const [top, recent, categories, sponsors] = await Promise.all([
    listApps({ sort: 'mrr', limit: 100 }),
    listApps({ sort: 'newest', limit: 8 }),
    listCategories(),
    listActiveSponsors(TOTAL_SPOTS),
  ])

  const spotsLeft = Math.max(0, TOTAL_SPOTS - sponsors.length)

  return (
    <>
      <AdRail side="left" sponsors={sponsors} spotsLeft={spotsLeft} />
      <AdRail side="right" sponsors={sponsors} spotsLeft={spotsLeft} />

      <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        {/* Hero */}
        <section className="pt-12 text-center sm:pt-16">
          <h1 className="display mx-auto max-w-4xl text-[clamp(1.9rem,5.2vw,3.5rem)]">
            The database of verified iOS app revenue
          </h1>
          <p className="text-muted mx-auto mt-5 max-w-xl text-[13px] leading-relaxed">
            See what iOS apps really earn — or connect your own and prove yours. One read-only key,
            refreshed hourly.{' '}
            <Link
              href="/verification"
              className="text-fg hover:text-blue underline underline-offset-4"
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
        <section className="border-border bg-surface mt-10 overflow-hidden rounded-[10px] border">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-fg text-[15px] font-bold">Top 100 by MRR</h2>
            <div className="text-muted flex items-center gap-2 text-[12px]">
              <span className="border-border bg-surface-2 rounded-md border px-2 py-1">MRR</span>
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
        <section className="border-border bg-surface mt-10 rounded-[10px] border p-5 sm:p-6">
          <h2 className="text-fg text-[15px] font-bold">What &ldquo;verified&rdquo; means here</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <Explainer
              index="01"
              title="Read-only, scoped keys"
              body="Founders connect a key that can read revenue charts and nothing else. It cannot see customers, issue refunds, or change a paywall."
            />
            <Explainer
              index="02"
              title="Refreshed every hour"
              body="A number that was true last quarter is not verification. Every connected app is re-read hourly, and each profile shows its last sync."
            />
            <Explainer
              index="03"
              title="Credentials stay encrypted"
              body="Keys are encrypted before they touch the database and are never returned to a browser — not even to the founder who added them."
            />
          </div>
          <Link
            href="/verification"
            className="text-fg hover:text-blue mt-5 inline-block text-[12px] underline underline-offset-4"
          >
            Read the full method →
          </Link>
        </section>
      </div>
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
