import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card'
import { site } from '@/lib/site'

/**
 * The fallback social card. Every route without its own `opengraph-image`
 * inherits this one, which is most of them — only app, founder, and category
 * pages have a figure worth putting on a card of their own.
 */
export const alt = `${site.shortName} - ${site.tagline}`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return ogCard({
    title: 'The database of verified iOS app revenue',
    subtitle: 'Read straight from RevenueCat or App Store Connect. Never typed in by hand.',
  })
}
