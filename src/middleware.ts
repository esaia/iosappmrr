import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

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

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — session refresh on a
     * favicon request is wasted work.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}
