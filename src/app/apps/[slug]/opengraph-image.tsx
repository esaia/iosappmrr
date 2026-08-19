import { getAppBySlug } from '@/lib/data/apps'
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card'
import { formatMrr } from '@/lib/utils'

/**
 * An app's own card, which is the one that matters: these are the URLs founders
 * paste into X, and the verified figure is the reason anyone clicks. Generated
 * on demand and cached rather than at build time, because the figure changes
 * daily and there is no point baking a stale one into the build.
 */
export const alt = 'Verified monthly revenue'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 3600

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const record = await getAppBySlug(slug)

  if (!record) {
    return ogCard({ title: 'App not found' })
  }

  const { app, metadata, metrics } = record
  const mrrCents = Number(metrics?.mrrCents ?? 0)

  return ogCard({
    title: app.name,
    subtitle: app.tagline,
    // The number, set as large as the card allows. It is the reason the link
    // gets clicked, so nothing on the card competes with it.
    hero:
      mrrCents > 0
        ? { label: 'Verified MRR', value: formatMrr(mrrCents), unit: '/mo' }
        : { label: 'Verified revenue', value: '—' },
    // Apple's CDN serves these at up to 1024px; 256 is all the card needs and
    // fetching the smaller variant keeps image generation quick.
    iconUrl: metadata?.iconUrl?.replace(/\/\d+x\d+bb\./, '/256x256bb.') ?? metadata?.iconUrl,
  })
}
