import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppRow, AppRowHeader } from '@/components/app-row'
import { listApps, listCategories } from '@/lib/data/apps'
import { formatMrr } from '@/lib/utils'
import { Container } from '@/components/ui/container'

export const revalidate = 600

type Params = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const categories = await listCategories()
  return categories.map((category) => ({ slug: category.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const category = (await listCategories()).find((c) => c.slug === slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: `${category.name} apps by verified revenue`,
    description: `${category.appCount} verified ${category.name} apps on the App Store, ranked by monthly recurring revenue.`,
    alternates: { canonical: `/categories/${slug}` },
  }
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params
  const category = (await listCategories()).find((c) => c.slug === slug)
  if (!category) notFound()

  const apps = await listApps({ categorySlug: slug, sort: 'mrr', limit: 100 })

  return (
    <Container className="py-10 sm:py-14">
      <nav className="text-muted mb-6 text-xs">
        <Link href="/categories" className="hover:text-fg">
          Categories
        </Link>
      </nav>

      <h1 className="display text-4xl font-semibold sm:text-5xl">{category.name}</h1>
      <p className="text-muted mt-3 max-w-lg">{category.description}</p>
      <p className="text-muted mt-2 text-sm">
        {category.appCount} apps · {formatMrr(Number(category.totalMrrCents))}/mo combined
      </p>

      {apps.length > 0 && (
        <div className="border-border bg-surface rounded-card mt-8 overflow-hidden border">
          <AppRowHeader />
          {apps.map((app, index) => (
            <AppRow key={app.id} app={app} rank={index + 1} />
          ))}
        </div>
      )}

      {apps.length === 0 && (
        <p className="border-border-strong text-muted rounded-card mt-10 border border-dashed p-10 text-center">
          No verified {category.name} apps yet.
        </p>
      )}
    </Container>
  )
}
