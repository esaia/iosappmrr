import { NextResponse } from 'next/server'
import { listApps } from '@/lib/data/apps'

/**
 * Typeahead for the hero search. Deliberately small: enough to identify a row
 * and jump to it, not enough to serve as a public data export.
 */
export const dynamic = 'force-dynamic'

const MAX_QUERY = 64
const LIMIT = 8

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''

  // One character matches most of the table; make the client wait for two.
  if (query.length < 2) return NextResponse.json({ results: [] })

  const apps = await listApps({ search: query.slice(0, MAX_QUERY), sort: 'mrr', limit: LIMIT })

  return NextResponse.json(
    {
      results: apps.map((app) => ({
        slug: app.slug,
        name: app.name,
        tagline: app.tagline,
        iconUrl: app.iconUrl,
        categoryName: app.categoryName,
        mrrCents: app.mrrCents,
        verified: app.providers.length > 0,
      })),
    },
    // Repeat keystrokes across users hit the same few prefixes.
    { headers: { 'cache-control': 'public, max-age=15, stale-while-revalidate=60' } },
  )
}
