import type { Metadata } from 'next'
import Link from 'next/link'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { TechIcon } from '@/components/tech-icon'
import { countApps, listApps, listCategories, listTechTags, type AppSort } from '@/lib/data/apps'
import { Container } from '@/components/ui/container'

export const revalidate = 600

const DESCRIPTION =
  'Browse App Store apps with revenue read directly from RevenueCat, Adapty, or App Store Connect. Filter by category, tech stack, and revenue.'

/**
 * This route is one list behind five query parameters, so most of its URLs are
 * the same rows in a different order. What each kind of URL is worth to an index
 * differs, and the metadata says so rather than letting a crawler guess:
 *
 * - `?q=` is a search result. Nobody should arrive on one from a search engine,
 *   and Google asks explicitly that internal results stay out of an index.
 * - `?category=` duplicates /categories/[slug], which has a real title and its
 *   own copy. That page is the canonical version of the same list.
 * - `?tech=` has no page of its own, and a slice this thin is not worth an entry
 *   of its own either. Followable, so the app pages in it still get crawled.
 * - `?page=` is a genuine continuation, so each page self-canonicalises and
 *   carries its number in the title. Canonicalising page 2 to page 1 would say
 *   the apps ranked 31–60 do not exist.
 * - `?sort=` is a reordering, and collapses to the bare path.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)

  if (params.q) {
    return {
      title: `Search: ${params.q}`,
      description: DESCRIPTION,
      robots: { index: false, follow: true },
    }
  }

  if (params.category) {
    return {
      title: 'Every verified iOS app',
      description: DESCRIPTION,
      alternates: { canonical: `/categories/${params.category}` },
    }
  }

  if (params.tech) {
    return {
      title: 'Every verified iOS app',
      description: DESCRIPTION,
      robots: { index: false, follow: true },
    }
  }

  return {
    title: page > 1 ? `Every verified iOS app — page ${page}` : 'Every verified iOS app',
    description: DESCRIPTION,
    alternates: { canonical: page > 1 ? `/apps?page=${page}` : '/apps' },
  }
}

const PAGE_SIZE = 30

const SORTS: { value: AppSort; label: string }[] = [
  { value: 'mrr', label: 'Revenue' },
  { value: 'growth', label: 'Growth' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
]
type Props = {
  searchParams: Promise<{
    sort?: string
    category?: string
    tech?: string
    q?: string
    page?: string
  }>
}

export default async function AppsPage({ searchParams }: Props) {
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
    <Container className="py-10 sm:py-14">
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
          className="border-border bg-surface text-fg placeholder:text-muted focus:border-accent/60 focus:ring-accent/25 rounded-card w-full border px-4 py-2.5 text-sm focus:ring-4 focus:outline-none"
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
              <TechIcon slug={tag.slug} className="size-3" />
              {tag.name}
            </FilterChip>
          ))}
      </div>

      {apps.length > 0 && (
        <div className="border-border bg-surface rounded-card mt-6 overflow-hidden border">
          <AppRowHeader withRank={false} />
          {apps.map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted rounded-card mt-10 border border-dashed p-10 text-center">
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
    </Container>
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
          ? 'bg-blue-dim text-blue inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium'
          : 'text-muted hover:bg-surface-2 hover:text-fg inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors'
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
