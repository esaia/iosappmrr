import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { appTechStack, categories, techStackTags } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { getOwnedApp, listAllTechTags } from '@/lib/data/mutations'
import { countActiveSponsors } from '@/lib/data/purchases'
import { isPolarConfigured } from '@/lib/polar'
import { getSponsorSlots } from '@/lib/settings'
import { purchases } from '@/db/schema'
import { and } from 'drizzle-orm'
import { EditForm } from './edit-form'

export const metadata: Metadata = {
  title: 'Edit app',
  robots: { index: false },
}

export default async function EditPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) notFound()

  const [
    categoryList,
    techList,
    currentTech,
    currentCategory,
    sponsorCount,
    sponsorRow,
    totalSpots,
  ] = await Promise.all([
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder)),
    listAllTechTags(),
    db
      .select({ slug: techStackTags.slug })
      .from(appTechStack)
      .innerJoin(techStackTags, eq(techStackTags.id, appTechStack.tagId))
      .where(eq(appTechStack.appId, app.id)),
    app.categoryId
      ? db
          .select({ slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, app.categoryId))
          .limit(1)
      : Promise.resolve([]),
    countActiveSponsors(),
    db
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.appId, app.id),
          eq(purchases.kind, 'sponsor'),
          eq(purchases.status, 'active'),
        ),
      )
      .limit(1),
    getSponsorSlots(),
  ])

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="text-muted mb-6 text-xs">
        <Link href="/dashboard" className="hover:text-fg">
          Dashboard
        </Link>
        {' / '} {app.name}
      </nav>

      <h1 className="display mt-2 text-4xl font-semibold">Edit {app.name}</h1>
      <p className="text-muted mt-3 leading-relaxed">
        Everything here is yours to change. Revenue is not — it is read from your provider and
        cannot be edited by hand, which is the point of the site.
      </p>

      <EditForm
        appId={app.id}
        appName={app.name}
        categories={categoryList}
        tech={techList.map((t) => ({ slug: t.slug, name: t.name }))}
        offers={{
          dofollowAvailable: isPolarConfigured('dofollow'),
          sponsorAvailable: isPolarConfigured('sponsor'),
          sponsorActive: sponsorRow.length > 0,
          spotsLeft: Math.max(0, totalSpots - sponsorCount),
          totalSpots,
        }}
        initial={{
          name: app.name,
          tagline: app.tagline ?? '',
          description: app.description ?? '',
          categorySlug: currentCategory[0]?.slug ?? '',
          website: app.website ?? '',
          websiteDofollow: app.websiteDofollow,
          tech: currentTech.map((t) => t.slug),
        }}
      />
    </div>
  )
}
