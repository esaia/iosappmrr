import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { appTechStack, categories, techStackTags } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import { getOwnedApp, listAllTechTags } from '@/lib/data/mutations'
import { getSlotInventory } from '@/lib/data/purchases'
import { isPolarConfigured } from '@/lib/polar'
import { purchases } from '@/db/schema'
import { and } from 'drizzle-orm'
import { EditForm } from './edit-form'
import { Container, Measure } from '@/components/ui/container'

export const metadata: Metadata = {
  title: 'Edit app',
  robots: { index: false },
}

export default async function EditPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) notFound()

  const [categoryList, techList, currentTech, currentCategory, inventory, livePurchases] =
    await Promise.all([
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
      getSlotInventory(),
      /*
       * Both kinds in one query. The cards need more than "is it on" now: the
       * row's id, so the switch has something to act on, and whether it is
       * hidden, so the card cannot claim to be sponsoring the rails while it
       * is switched off.
       */
      db
        .select({ id: purchases.id, kind: purchases.kind, hidden: purchases.hidden })
        .from(purchases)
        .where(and(eq(purchases.appId, app.id), eq(purchases.status, 'active'))),
    ])

  /*
   * A dofollow link can be held twice — a gift layered over an older paid row —
   * so the switch acts on the newest, which is the one the site is reading.
   */
  const sponsorPurchase = livePurchases.find((row) => row.kind === 'sponsor') ?? null
  const dofollowPurchase = livePurchases.find((row) => row.kind === 'dofollow') ?? null

  return (
    <Container className="py-10 sm:py-14">
      <Measure className="mx-auto">
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
            sponsorActive: Boolean(sponsorPurchase),
            sponsorPurchase,
            dofollowPurchase,
            spotsLeft: inventory.free,
            totalSpots: inventory.slots,
          }}
          initial={{
            name: app.name,
            tagline: app.tagline ?? '',
            description: app.description ?? '',
            categorySlug: currentCategory[0]?.slug ?? '',
            website: app.website ?? '',
            tech: currentTech.map((t) => t.slug),
            anonymous: app.isAnonymous,
          }}
        />
      </Measure>
    </Container>
  )
}
