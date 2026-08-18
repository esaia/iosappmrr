import 'server-only'
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { appStoreMetadata, apps, purchases } from '@/db/schema'
import type { PurchaseKind } from '@/lib/polar'

/**
 * Records a checkout the moment it is created, before Polar has taken any
 * money. The row exists so a webhook that arrives before the browser redirect
 * completes has something to update, and so abandoned checkouts are visible
 * rather than invisible.
 */
export async function recordPendingPurchase(input: {
  kind: PurchaseKind
  appId: string
  profileId: string
  polarCheckoutId: string
}) {
  await db
    .insert(purchases)
    .values({ ...input, status: 'pending' })
    // A founder who abandons a checkout and starts another gets a new row; a
    // duplicate id can only be a retry of the same one.
    .onConflictDoNothing({ target: purchases.polarCheckoutId })
}

/**
 * Promotes a purchase to `active` and grants what was bought.
 *
 * Idempotent on the checkout id: Polar delivers webhooks at least once, and
 * `order.paid` can legitimately arrive twice. Granting is a write of a fixed
 * value rather than an increment, so a replay is a no-op.
 *
 * Returns false when the checkout is unknown — which happens if the metadata
 * was lost or the row was deleted with its app. The caller still acknowledges
 * the webhook, because retrying will not make an absent row appear.
 */
export async function activatePurchase(input: {
  polarCheckoutId: string
  polarOrderId?: string | null
  polarSubscriptionId?: string | null
  amountCents?: number | null
  currency?: string | null
  currentPeriodEnd?: Date | null
}) {
  const [row] = await db
    .update(purchases)
    .set({
      status: 'active',
      polarOrderId: input.polarOrderId ?? undefined,
      polarSubscriptionId: input.polarSubscriptionId ?? undefined,
      amountCents: input.amountCents ?? undefined,
      currency: input.currency ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(purchases.polarCheckoutId, input.polarCheckoutId))
    .returning({ id: purchases.id, kind: purchases.kind, appId: purchases.appId })

  if (!row) return false

  if (row.kind === 'dofollow') {
    await db.update(apps).set({ websiteDofollow: true }).where(eq(apps.id, row.appId))
  }

  return true
}

/**
 * Withdraws a purchase after a refund or a lapsed subscription.
 *
 * Looked up by subscription id when there is one, so a cancellation that
 * arrives without the original checkout id still finds its row.
 */
export async function revokePurchase(input: {
  polarCheckoutId?: string | null
  polarSubscriptionId?: string | null
}) {
  const match = input.polarSubscriptionId
    ? eq(purchases.polarSubscriptionId, input.polarSubscriptionId)
    : input.polarCheckoutId
      ? eq(purchases.polarCheckoutId, input.polarCheckoutId)
      : null

  if (!match) return false

  const [row] = await db
    .update(purchases)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(match)
    .returning({ kind: purchases.kind, appId: purchases.appId })

  if (!row) return false

  if (row.kind === 'dofollow') {
    /*
     * Only drop the link if no other active dofollow purchase covers this app.
     * A founder who bought, refunded, then bought again should keep the link
     * the second purchase paid for.
     */
    const [survivor] = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.appId, row.appId),
          eq(purchases.kind, 'dofollow'),
          eq(purchases.status, 'active'),
        ),
      )
      .limit(1)

    if (!survivor) {
      await db.update(apps).set({ websiteDofollow: false }).where(eq(apps.id, row.appId))
    }
  }

  return true
}

/** The purchase state the edit screen renders for one app. */
export async function getDofollowState(appId: string) {
  const [row] = await db
    .select({ status: purchases.status })
    .from(purchases)
    .where(and(eq(purchases.appId, appId), eq(purchases.kind, 'dofollow')))
    .orderBy(desc(purchases.createdAt))
    .limit(1)

  return row?.status ?? null
}

export type Sponsor = {
  appId: string
  slug: string
  name: string
  tagline: string | null
  iconUrl: string | null
  website: string | null
}

/**
 * Sponsors currently entitled to a rail slot.
 *
 * The creative is the app's own listing — icon, name, tagline — rather than an
 * uploaded banner. That means a sponsor can buy a slot without anyone
 * designing, uploading, or moderating an image, and the rails cannot show
 * artwork the site has not already indexed from the App Store.
 *
 * `current_period_end` is checked here rather than by a nightly job, so a
 * lapsed sponsor stops appearing the moment their period ends.
 */
export async function listActiveSponsors(limit: number): Promise<Sponsor[]> {
  return db
    .select({
      appId: apps.id,
      slug: apps.slug,
      name: apps.name,
      tagline: apps.tagline,
      iconUrl: appStoreMetadata.iconUrl,
      website: apps.website,
    })
    .from(purchases)
    .innerJoin(apps, eq(apps.id, purchases.appId))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(
      and(
        eq(purchases.kind, 'sponsor'),
        eq(purchases.status, 'active'),
        eq(apps.status, 'live'),
        or(isNull(purchases.currentPeriodEnd), gt(purchases.currentPeriodEnd, sql`now()`)),
      ),
    )
    .orderBy(purchases.createdAt)
    .limit(limit)
}

/** How many rail slots are still unsold. */
export async function countActiveSponsors() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(purchases)
    .where(
      and(
        eq(purchases.kind, 'sponsor'),
        eq(purchases.status, 'active'),
        or(isNull(purchases.currentPeriodEnd), gt(purchases.currentPeriodEnd, sql`now()`)),
      ),
    )

  return row?.count ?? 0
}
