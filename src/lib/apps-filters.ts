/**
 * The filters behind /apps, and the cache key they become.
 *
 * Reading `searchParams` in a page makes Next render it on every request, so
 * /apps used to run a function for every visit and every crawler walking its
 * filter links. Instead the middleware turns the query into one opaque path
 * segment and rewrites to /apps-view/[key], a page cached on first visit like
 * any other. Normalising first means the same view is always the same key:
 * `?page=1`, `?sort=mrr` and stray tracking parameters all land on the bare,
 * already-cached /apps.
 *
 * Pure and dependency-free so the middleware can import it.
 */

export const APPS_SORTS = ['mrr', 'growth', 'newest', 'name'] as const
export type AppsSort = (typeof APPS_SORTS)[number]

export type AppsFilters = {
  sort?: Exclude<AppsSort, 'mrr'>
  category?: string
  tech?: string
  q?: string
  page?: number
}

const SLUG = /^[a-z0-9-]{1,64}$/
const MAX_QUERY = 100
const MAX_PAGE = 1000

/** Keeps only what changes the list, in canonical form. */
export function normalizeAppsFilters(params: URLSearchParams): AppsFilters {
  const filters: AppsFilters = {}

  const sort = params.get('sort')
  if (sort && sort !== 'mrr' && (APPS_SORTS as readonly string[]).includes(sort)) {
    filters.sort = sort as AppsFilters['sort']
  }

  const category = params.get('category')
  if (category && SLUG.test(category)) filters.category = category

  const tech = params.get('tech')
  if (tech && SLUG.test(tech)) filters.tech = tech

  const q = params.get('q')?.trim().slice(0, MAX_QUERY)
  if (q) filters.q = q

  const page = Math.floor(Number(params.get('page')))
  if (page > 1 && page <= MAX_PAGE) filters.page = page

  return filters
}

/** The query string for these filters, in a fixed order. Empty for the bare list. */
export function appsQuery(filters: AppsFilters): string {
  const query = new URLSearchParams()
  if (filters.sort) query.set('sort', filters.sort)
  if (filters.category) query.set('category', filters.category)
  if (filters.tech) query.set('tech', filters.tech)
  if (filters.q) query.set('q', filters.q)
  if (filters.page && filters.page > 1) query.set('page', String(filters.page))
  return query.toString()
}

/** The public URL of a view. */
export function appsHref(filters: AppsFilters): string {
  const query = appsQuery(filters)
  return query ? `/apps?${query}` : '/apps'
}

/**
 * The path segment for a view, or null for the bare list. base64url so a search
 * term's `&`, `/` or `%` can never be read as part of the path.
 */
export function encodeAppsKey(filters: AppsFilters): string | null {
  const query = appsQuery(filters)
  if (!query) return null
  const bytes = new TextEncoder().encode(query)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The inverse of `encodeAppsKey`; null for anything it would not have produced. */
export function decodeAppsKey(key: string): AppsFilters | null {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null
  try {
    const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
    const query = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
    const filters = normalizeAppsFilters(new URLSearchParams(query))
    // A key that does not round-trip is not one the middleware made; refusing
    // it keeps a hand-crafted URL from filling the cache with duplicates.
    return encodeAppsKey(filters) === key ? filters : null
  } catch {
    return null
  }
}
