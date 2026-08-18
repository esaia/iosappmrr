import type { Metadata } from 'next'
import Link from 'next/link'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { countApps, listApps, listCategories, listTechTags, type AppSort } from '@/lib/data/apps'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Every verified iOS app',
  description:
    'Browse App Store apps with revenue read directly from RevenueCat, App Store Connect, or Stripe. Filter by category, tech stack, and revenue.',
}

const PAGE_SIZE = 30

const SORTS: { value: AppSort; label: string }[] = [
  { value: 'mrr', label: 'Revenue' },
  { value: 'growth', label: 'Growth' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
]
export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string
    category?: string
    tech?: string
    q?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const sort = (SORTS.find((s) => s.value === params.sort)?.value ?? 'mrr') as AppSort
  const page = Math.max(1, Number(params.page) || 1)

  const [apps, total, categories, tech] = await Promise.all([
    listApps({
      sort,
      categorySlug: params.category,
      techSlug: params.tech,
      search: params.q,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    countApps({ categorySlug: params.category, search: params.q }),
    listCategories(),
    listTechTags(),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  /** Preserves the current filters while changing one of them. */
  const linkWith = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams()
    const merged = { ...params, ...changes, page: undefined }
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, String(value))
    }
    const query = next.toString()
    return query ? `/apps?${query}` : '/apps'
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="display text-4xl font-semibold sm:text-5xl">Apps</h1>
        <p className="text-muted mt-3">
          {total} verified {total === 1 ? 'app' : 'apps'} on the App Store.{' '}
        </p>
      </header>

      <form action="/apps" method="get" className="mt-6">
        {params.category && <input type="hidden" name="category" value={params.category} />}
        {params.tech && <input type="hidden" name="tech" value={params.tech} />}
        <label htmlFor="q" className="sr-only">
          Search apps
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q ?? ''}
          placeholder="Search by name or tagline"
          className="border-border bg-surface text-fg placeholder:text-muted focus:border-border-strong w-full rounded-[10px] border px-4 py-2.5 text-sm focus:outline-none"
        />
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {SORTS.map((option) => (
          <Link
            key={option.value}
            href={linkWith({ sort: option.value === 'mrr' ? undefined : option.value })}
            aria-current={option.value === sort ? 'true' : undefined}
            className={
              option.value === sort
                ? 'bg-accent text-accent-fg rounded-lg px-2.5 py-1 text-[13px] font-medium'
                : 'border-border text-muted hover:border-border-strong hover:text-fg rounded-lg border px-2.5 py-1 text-[13px]'
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip href={linkWith({ category: undefined })} active={!params.category}>
          All categories
        </FilterChip>
        {categories
          .filter((category) => category.appCount > 0)
          .map((category) => (
            <FilterChip
              key={category.slug}
              href={linkWith({ category: category.slug })}
              active={params.category === category.slug}
            >
              {category.name}
            </FilterChip>
          ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <FilterChip href={linkWith({ tech: undefined })} active={!params.tech}>
          Any stack
        </FilterChip>
        {tech
          .filter((tag) => tag.appCount > 0)
          .slice(0, 10)
          .map((tag) => (
            <FilterChip
              key={tag.slug}
              href={linkWith({ tech: tag.slug })}
              active={params.tech === tag.slug}
            >
              {tag.name}
            </FilterChip>
          ))}
      </div>

      {apps.length > 0 && (
        <div className="border-border bg-surface mt-6 overflow-hidden rounded-[10px] border">
          <AppRowHeader withRank={false} />
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted mt-10 rounded-[10px] border border-dashed p-10 text-center">
          Nothing matches those filters yet.
        </p>
      )}

      {pageCount > 1 && (
        <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
          <PageLink params={params} page={page - 1} disabled={page === 1}>
            Previous
          </PageLink>
          <span className="text-muted text-xs">
            Page {page} of {pageCount}
          </span>
          <PageLink params={params} page={page + 1} disabled={page >= pageCount}>
            Next
          </PageLink>
        </nav>
      )}
    </div>
  )
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'bg-blue-dim text-blue rounded-md px-2 py-1 text-xs font-medium'
          : 'text-muted hover:bg-surface-2 hover:text-fg rounded-md px-2 py-1 text-xs transition-colors'
      }
    >
      {children}
    </Link>
  )
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | undefined>
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return <span className="text-muted text-sm opacity-50">{children}</span>
  }

  const next = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...params, page: String(page) })) {
    if (value) next.set(key, value)
  }

  return (
    <Link href={`/apps?${next}`} className="text-blue text-sm hover:underline">
      {children}
    </Link>
  )
}
