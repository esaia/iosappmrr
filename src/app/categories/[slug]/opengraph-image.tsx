import { listCategories } from '@/lib/data/apps'
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card'
import { formatMrr } from '@/lib/utils'

export const alt = 'Verified iOS app revenue by category'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 3600

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = (await listCategories()).find((c) => c.slug === slug)

  if (!category) return ogCard({ title: 'Category not found' })

  const total = Number(category.totalMrrCents)

  return ogCard({
    title: `${category.name} apps by verified revenue`,
    subtitle: category.description,
    figure: total > 0 ? `${formatMrr(total)}/mo across ${category.appCount} apps` : null,
  })
}
