import { getAppBySlug, getRevenueHistory } from '@/lib/data/apps'
import { SHARE_PERIODS, parseShareOptions, periodDays } from '@/lib/share-image'
import { shareCard } from '@/lib/og/share-card'

/**
 * The share image for one app, as a PNG.
 *
 * A route rather than a canvas in the browser: the same URL gives everyone the
 * same file, it can be cached, and it is a real image the moment it exists —
 * pasteable into a post, or into an `<img>` on the founder's own site.
 *
 * Public, and only ever renders what the app page already shows. `getAppBySlug`
 * returns live listings only and applies the stealth substitutions itself, so
 * an anonymous app cannot be made to leak its name or icon through this route
 * by anyone who knows its slug.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const options = parseShareOptions(new URL(request.url).searchParams)

  const record = await getAppBySlug(slug)
  if (!record) return new Response('Not found', { status: 404 })

  const { app, metadata, metrics } = record
  const mrrCents = Number(metrics?.mrrCents ?? 0)

  const days = periodDays(options.period)
  const history = options.variant === 'chart' ? await getRevenueHistory(app.id, days) : []

  const image = await shareCard({
    name: app.name,
    // Apple's CDN serves these up to 1024px; the card never draws one above
    // 154, and fetching the smaller variant keeps rendering quick.
    iconUrl: metadata?.iconUrl?.replace(/\/\d+x\d+bb\./, '/256x256bb.') ?? metadata?.iconUrl,
    mrrCents,
    points: history.map((point) => ({
      date: point.date,
      mrrCents: point.mrrCents,
      revenueCents: point.revenueCents,
    })),
    periodLabel: `last ${SHARE_PERIODS.find((period) => period.id === options.period)!.label}`,
    options,
  })

  /*
   * An hour at the edge. The figure behind it moves once a day, and a founder
   * flicking between colours in the dialog should not re-render the same card
   * on every click.
   */
  const headers = new Headers(image.headers)
  headers.set('cache-control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return new Response(image.body, { headers })
}
