import { getFounderByHandle } from '@/lib/data/apps'
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card'
import { formatMrr, highResAvatar } from '@/lib/utils'

export const alt = 'Verified App Store revenue by founder'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 3600

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const record = await getFounderByHandle(handle)

  if (!record) return ogCard({ title: 'Founder not found' })

  const { founder, apps } = record
  const totalMrr = apps.reduce((sum, app) => sum + app.mrrCents, 0)
  const appCount = `${apps.length} ${apps.length === 1 ? 'app' : 'apps'}`

  return ogCard({
    title: founder.name ?? `@${founder.handle}`,
    subtitle: founder.bio ?? `${appCount} on the App Store`,
    figure: totalMrr > 0 ? `${formatMrr(totalMrr)}/mo across ${appCount}` : null,
    iconUrl: highResAvatar(founder.avatarUrl),
  })
}
