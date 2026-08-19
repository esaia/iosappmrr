import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { appStoreMetadata, apps, purchases } from '@/db/schema'

export type BillingRow = {
  id: string
  kind: 'dofollow' | 'sponsor'
  status: string
  source: 'polar' | 'admin'
  amountCents: number | null
  currency: string | null
  currentPeriodEnd: Date | null
  createdAt: Date
  polarSubscriptionId: string | null
  app: { id: string; slug: string; name: string; iconUrl: string | null }
}

/**
 * Every purchase a founder has made, newest first.
 *
 * Includes withdrawn and abandoned rows on purpose. A billing page that only
 * listed live entitlements would answer "what do I have?" but not "what was I
 * charged for?", and the second question is the one people open a billing page
 * with. The app is joined in because both products are bought for a specific
 * listing — a bare row saying "sponsor · $10/mo" is unactionable for a founder
 * with more than one app.
 */
export async function listBillingForProfile(profileId: string): Promise<BillingRow[]> {
  return db
    .select({
      id: purchases.id,
      kind: purchases.kind,
      status: purchases.status,
      source: purchases.source,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      currentPeriodEnd: purchases.currentPeriodEnd,
      createdAt: purchases.createdAt,
      polarSubscriptionId: purchases.polarSubscriptionId,
      app: {
        id: apps.id,
        slug: apps.slug,
        name: apps.name,
        iconUrl: appStoreMetadata.iconUrl,
      },
    })
    .from(purchases)
    .innerJoin(apps, eq(apps.id, purchases.appId))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(eq(purchases.profileId, profileId))
    .orderBy(desc(purchases.createdAt))
}
