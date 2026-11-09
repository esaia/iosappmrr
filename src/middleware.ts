import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { encodeAppsKey, normalizeAppsFilters } from '@/lib/apps-filters'

// The leaderboard's other sorts are cached pages of their own; the shared URL
// keeps its query string, and is quietly served from them.
const LEADERBOARD_SORTS = ['growth', 'newest']

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const sort = searchParams.get('sort')
  if (pathname === '/leaderboard' && sort && LEADERBOARD_SORTS.includes(sort)) {
    const url = request.nextUrl.clone()
    url.pathname = `/leaderboard/by/${sort}`
    url.search = ''
    return NextResponse.rewrite(url)
  }

  // Every filtered view of /apps is a cached page of its own; see apps-filters.
  if (pathname === '/apps' && request.nextUrl.search) {
    const key = encodeAppsKey(normalizeAppsFilters(searchParams))
    const url = request.nextUrl.clone()
    url.pathname = key ? `/apps-view/${key}` : '/apps'
    url.search = ''
    return NextResponse.rewrite(url)
  }

  return updateSession(request)
}

export const config = {
  /*
   * Only where it does something. Every request it matches is a function
   * invocation, even when the page behind it is served from the cache, so
   * running it site-wide billed every public visit and every crawler.
   *
   * - /leaderboard and /apps: the query-string rewrites above, and only when a
   *   query that changes the page is present — the bare pages are cached and
   *   need nothing. `has` entries are ANDed, hence one per parameter, written out
   *   because Next reads this config statically.
   * - The rest are Server Components that read the session, where cookies are
   *   read-only — a token that expired has to be refreshed here, before them.
   *
   * Server actions and route handlers that read the session refresh it
   * themselves (they can write cookies), and the header asks from the browser,
   * so the public pages need nothing from this.
   */
  matcher: [
    { source: '/leaderboard', has: [{ type: 'query', key: 'sort' }] },
    { source: '/apps', has: [{ type: 'query', key: 'sort' }] },
    { source: '/apps', has: [{ type: 'query', key: 'category' }] },
    { source: '/apps', has: [{ type: 'query', key: 'tech' }] },
    { source: '/apps', has: [{ type: 'query', key: 'q' }] },
    { source: '/apps', has: [{ type: 'query', key: 'page' }] },
    '/submit',
    '/dashboard/:path*',
    '/admin/:path*',
    '/account/:path*',
  ],
}
