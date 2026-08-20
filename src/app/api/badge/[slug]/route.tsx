import { getAppBySlug } from '@/lib/data/apps'
import { parseBadgeTheme } from '@/lib/embed-badge'
import { badgeImage } from '@/lib/og/badge'

/**
 * The embed badge for one app, as a PNG.
 *
 * This is the only route on the site that is meant to be hotlinked. It will be
 * requested by strangers' browsers, from pages we do not control, for as long
 * as the founder leaves it up — so it says only what the app page says, and it
 * is cached hard enough that a popular founder's traffic does not become ours
 * to render.
 *
 * `getAppBySlug` returns live listings only and applies the stealth
 * substitutions itself, so an anonymous app cannot be made to leak its name or
 * icon here by anyone who knows the slug.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const theme = parseBadgeTheme(new URL(request.url).searchParams.get('theme'))

  const record = await getAppBySlug(slug)
  if (!record) return new Response('Not found', { status: 404 })

  /*
   * Nothing unverified gets one of these.
   *
   * The image says VERIFIED in as many words, and it is meant to be hotlinked —
   * it will be requested from pages we do not control, by readers who never see
   * this site and have only the badge to go on. `getAppBySlug` returns any live
   * listing, verified or not, so without this a founder who never connected a
   * key could paste a verification of their own numbers onto their homepage.
   *
   * A 404 rather than an unverified variant: there is no such thing as a badge
   * that usefully certifies nothing, and the app page is where the real state
   * is shown.
   */
  if (!record.app.isVerified) return new Response('Not verified', { status: 404 })

  const image = await badgeImage({
    // Apple's CDN serves these up to 1024px; the badge never draws one above
    // 68, and fetching the smaller variant keeps rendering quick.
    iconUrl: record.metadata?.iconUrl?.replace(/\/\d+x\d+bb\./, '/128x128bb.') ?? null,
    mrrCents: Number(record.metrics?.mrrCents ?? 0),
    theme,
  })

  /*
   * A day at the edge, revalidated in the background for a week after that.
   *
   * The figure moves once a day, and this badge sits in a page that may be
   * loaded thousands of times between two syncs. A visitor seeing yesterday's
   * number for an hour costs nothing; re-rendering it per view costs a
   * function call each time.
   */
  const headers = new Headers(image.headers)
  headers.set(
    'cache-control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  )
  return new Response(image.body, { headers })
}
