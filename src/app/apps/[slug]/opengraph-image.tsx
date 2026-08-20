import { getAppBySlug } from '@/lib/data/apps'
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card'
import { formatMrr } from '@/lib/utils'

/**
 * An app's own card, which is the one that matters: these are the URLs founders
 * paste into X, and the verified figure is the reason anyone clicks. Generated
 * on demand and cached rather than at build time, because the figure changes
 * daily and there is no point baking a stale one into the build.
 */
export const alt = 'Monthly revenue'
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

  /*
   * The word is earned, not decoration.
   *
   * This card cannot 404 the way the share image and the embed badge do — it is
   * the link preview, and refusing it would leave a bare URL wherever the page
   * is pasted. So it drops the claim instead and reports the figure plainly. An
   * unverified listing still has a number; it just has nobody standing behind
   * it, and this card is seen by people who will never open the page to find
   * that out.
   */
  const label = app.isVerified ? 'Verified MRR' : 'Monthly revenue'

  return ogCard({
    title: app.name,
    subtitle: app.tagline,
    // The number, set as large as the card allows. It is the reason the link
    // gets clicked, so nothing on the card competes with it.
    hero:
      mrrCents > 0
        ? { label, value: formatMrr(mrrCents), unit: '/mo' }
        : { label: app.isVerified ? 'Verified revenue' : 'Revenue', value: '—' },
    // Apple's CDN serves these at up to 1024px; 256 is all the card needs and
    // fetching the smaller variant keeps image generation quick.
    iconUrl: metadata?.iconUrl?.replace(/\/\d+x\d+bb\./, '/256x256bb.') ?? metadata?.iconUrl,
  })
}
