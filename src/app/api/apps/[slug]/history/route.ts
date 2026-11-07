import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAppBySlug, getRevenueHistory } from '@/lib/data/apps'

/**
 * A year of an app's history, for signed-in readers.
 *
 * The app page itself is cached and only carries the free window, so it costs
 * nothing per visit. Signed-in readers ask for the rest here, which keeps the
 * per-request work to the people who actually get the longer view.
 */
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [viewer, record] = await Promise.all([getCurrentUser(), getAppBySlug(slug)])

  if (!viewer) return NextResponse.json({ error: 'Sign in to see more history' }, { status: 401 })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const history = await getRevenueHistory(record.app.id, 365)

  return NextResponse.json({ history }, { headers: { 'cache-control': 'private, no-store' } })
}
