import type { Metadata } from 'next'
import Link from 'next/link'
import { listCategories } from '@/lib/data/apps'
import { formatMrr } from '@/lib/utils'
import { Container } from '@/components/ui/container'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Verified iOS app revenue by App Store category.',
}

export default async function CategoriesPage() {
  const categories = await listCategories()

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="display text-4xl font-semibold sm:text-5xl">Categories</h1>
      <p className="text-muted mt-3 max-w-lg">
        Where the money actually is on the App Store, by category. Totals count verified revenue
        only.
      </p>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className="border-border bg-surface hover:border-border-strong rounded-card border p-5 transition-colors"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-fg font-medium">{category.name}</h2>
              <span className="tabular text-fg text-sm">
                {formatMrr(Number(category.totalMrrCents))}
                <span className="text-muted text-xs">/mo</span>
              </span>
            </div>
            <p className="text-muted mt-1 text-sm">{category.description}</p>
            <p className="text-muted mt-3 text-[11px]">
              {category.appCount} {category.appCount === 1 ? 'app' : 'apps'}
            </p>
          </Link>
        ))}
      </div>
    </Container>
  )
}
