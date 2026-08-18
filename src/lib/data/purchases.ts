import 'server-only'
import { and, desc, eq, gt, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { appStoreMetadata, apps, purchases, siteSettings } from '@/db/schema'
import { clampSlots } from '@/lib/settings'
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
    .returning({
      id: purchases.id,
      kind: purchases.kind,
      appId: purchases.appId,
      source: purchases.source,
    })

  if (!row) return false

  await applyGrant(row.kind, row.appId)
  if (row.source === 'polar') await supersedeGifts(row.kind, row.appId, row.id)
  return true
}

/**
 * Retires a gift that a real payment has replaced.
 *
 * A payment always wins. Without this an app could hold a gifted and a paid
 * entitlement of the same kind at once, and for a sponsor slot that is not
 * merely untidy: the rails and the slot count both read one row per purchase, so
 * the app would appear in the rails twice and consume two of the slots on sale.
 *
 * The gift is marked superseded rather than revoked — nothing was taken away,
 * the founder started paying for what they had been given, and the ledger should
 * say so. It also does not come back if the subscription later lapses: the slot
 * then ends the way any sponsor's does, and an admin can gift again
 * deliberately. A gift that silently resurrected months later would be
 * impossible to reason about.
 */
async function supersedeGifts(kind: PurchaseKind, appId: string, keepId: string) {
  await db
    .update(purchases)
    .set({ status: 'superseded', note: 'Replaced by a paid subscription.', updatedAt: new Date() })
    .where(
      and(
        eq(purchases.appId, appId),
        eq(purchases.kind, kind),
        eq(purchases.status, 'active'),
        eq(purchases.source, 'admin'),
        // Never touch the row that was just paid for.
        ne(purchases.id, keepId),
      ),
    )
}

/**
 * Turns on whatever a purchase entitles, given only its kind and app.
 *
 * Shared by the webhook and the admin screens so a gifted entitlement and a
 * bought one are indistinguishable to the rest of the site — there is no second
 * definition of "has a dofollow link" that could drift from this one.
 *
 * A sponsor slot needs nothing here: the rails read `purchases` directly, so
 * the row being `active` is the entitlement.
 */
async function applyGrant(kind: PurchaseKind, appId: string) {
  if (kind === 'dofollow') {
    await db.update(apps).set({ websiteDofollow: true }).where(eq(apps.id, appId))
  }
}

/**
 * Turns off what a purchase entitled, unless another live purchase still covers
 * it. That check is why this cannot be a plain inverse of `applyGrant`: a
 * founder who bought, refunded, then bought again keeps the link the second
 * purchase paid for, and an admin revoking a gift must not take away a slot
 * someone is paying for.
 */
async function applyRevoke(kind: PurchaseKind, appId: string) {
  if (kind !== 'dofollow') return

  const [survivor] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.appId, appId),
        eq(purchases.kind, 'dofollow'),
        eq(purchases.status, 'active'),
      ),
    )
    .limit(1)

  if (!survivor) {
    await db.update(apps).set({ websiteDofollow: false }).where(eq(apps.id, appId))
  }
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

  await applyRevoke(row.kind, row.appId)
  return true
}

/* -------------------------------------------------------------------------- */
/*                              Admin-granted rows                             */
/* -------------------------------------------------------------------------- */

/**
 * Grants an entitlement without a payment — a gift, or a repair after a webhook
 * that never arrived.
 *
 * Written as a `purchases` row rather than by flipping the app's flag directly,
 * so gifts appear in the same ledger as sales, expire the same way, and can be
 * withdrawn by the same code. `source` is what separates them at reporting
 * time; nothing else in the site distinguishes the two.
 *
 * Callers must already have checked that the actor is an admin.
 */
export async function grantPurchase(input: {
  kind: PurchaseKind
  appId: string
  /** The founder who owns the app — the gift belongs to them, not to the admin. */
  profileId: string
  grantedBy: string
  note?: string | null
  /** When a gifted sponsor slot lapses. Null means it does not expire. */
  currentPeriodEnd?: Date | null
}) {
  const [row] = await db
    .insert(purchases)
    .values({
      kind: input.kind,
      appId: input.appId,
      profileId: input.profileId,
      status: 'active',
      source: 'admin',
      grantedBy: input.grantedBy,
      note: input.note ?? null,
      // Zero rather than null: the row did settle, for nothing. Null would read
      // as "amount unknown" alongside the pending checkouts that use it.
      amountCents: 0,
      currency: 'USD',
      currentPeriodEnd: input.currentPeriodEnd ?? null,
    })
    .returning({ id: purchases.id })

  await applyGrant(input.kind, input.appId)
  return row.id
}

/**
 * Withdraws one purchase by its own id, whoever granted it.
 *
 * This is the admin counterpart to `revokePurchase`, which finds its row
 * through Polar's identifiers. An admin is looking at a specific row on screen
 * and means that one — including a paid row, which is how a refund handled
 * outside Polar gets reflected here.
 */
export async function revokePurchaseById(id: string, note?: string | null) {
  const [row] = await db
    .update(purchases)
    .set({ status: 'revoked', note: note ?? undefined, updatedAt: new Date() })
    .where(eq(purchases.id, id))
    .returning({ kind: purchases.kind, appId: purchases.appId })

  if (!row) return false

  await applyRevoke(row.kind, row.appId)
  return true
}

/**
 * Promotes a stuck `pending` row to `active` by hand.
 *
 * The escape hatch for a webhook that never arrived and a Polar order that
 * `polar:reconcile` cannot see. It grants without proof of payment, so it is
 * deliberately a separate, logged action rather than part of the normal flow.
 */
export async function activatePurchaseById(id: string, note?: string | null) {
  const [row] = await db
    .update(purchases)
    .set({ status: 'active', note: note ?? undefined, updatedAt: new Date() })
    .where(eq(purchases.id, id))
    .returning({ kind: purchases.kind, appId: purchases.appId })

  if (!row) return false

  await applyGrant(row.kind, row.appId)
  return true
}

export type Entitlement = {
  id: string
  source: 'polar' | 'admin'
  /** Null for a one-off purchase, or for a gift with no expiry. */
  currentPeriodEnd: Date | null
  polarSubscriptionId: string | null
}

/**
 * The live entitlement of one kind for one app, and where it came from.
 *
 * `source` is what the admin screens branch on: a gift can be withdrawn, a paid
 * subscription cannot. The paid row is returned in preference to a gifted one,
 * so a brief overlap — a payment that landed before its gift was superseded —
 * still reports the answer that matters.
 */
export async function getAppEntitlement(
  appId: string,
  kind: PurchaseKind,
): Promise<Entitlement | null> {
  const [row] = await db
    .select({
      id: purchases.id,
      source: purchases.source,
      currentPeriodEnd: purchases.currentPeriodEnd,
      polarSubscriptionId: purchases.polarSubscriptionId,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.appId, appId),
        eq(purchases.kind, kind),
        eq(purchases.status, 'active'),
        or(isNull(purchases.currentPeriodEnd), gt(purchases.currentPeriodEnd, sql`now()`)),
      ),
    )
    .orderBy(
      sql`case when ${purchases.source} = 'polar' then 0 else 1 end`,
      desc(purchases.createdAt),
    )
    .limit(1)

  return row ?? null
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
  const rows = await db
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

  /*
   * One card per app. An app can hold a gift and the paid row that replaced it
   * for the moment between the two writes, and showing it in two rails at once
   * would be visible to every reader.
   */
  const seen = new Set<string>()
  return rows.filter((row) => !seen.has(row.appId) && seen.add(row.appId))
}

/**
 * How many rail slots are occupied.
 *
 * Counts distinct apps rather than purchase rows. An app can briefly hold both a
 * gift and the paid row that replaces it, and counting rows would report the
 * rails as fuller than they are — and could refuse a sale on inventory that is
 * actually free.
 */
export async function countActiveSponsors() {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${purchases.appId})::int` })
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

/**
 * Withdraws every live entitlement of one kind from an app.
 *
 * "Turn this app's dofollow link off" is one intention, but it can span several
 * rows — a gift layered on top of an old paid purchase, say. Revoking them one
 * at a time through the UI would leave the flag on until the last one went, so
 * the whole set moves together and the flag is settled once at the end.
 *
 * Returns how many rows were withdrawn, which is what the audit entry records.
 */
export async function revokeActivePurchasesForApp(
  appId: string,
  kind: PurchaseKind,
  note?: string | null,
  /**
   * Restricts the revoke to one source.
   *
   * The admin screens pass 'admin', because a slot someone is paying for is not
   * theirs to switch off — it ends when the subscription ends, and Polar's
   * webhook is what tells us that. Expressing it as a filter here, rather than
   * only as a check in the action, means the safe behaviour survives a future
   * caller that forgets to look first.
   */
  source?: 'admin' | 'polar',
) {
  const rows = await db
    .update(purchases)
    .set({ status: 'revoked', note: note ?? undefined, updatedAt: new Date() })
    .where(
      and(
        eq(purchases.appId, appId),
        eq(purchases.kind, kind),
        eq(purchases.status, 'active'),
        source ? eq(purchases.source, source) : undefined,
      ),
    )
    .returning({ id: purchases.id })

  await applyRevoke(kind, appId)
  return rows.length
}

/**
 * The slot count and how many are taken, in one round trip.
 *
 * Every screen that offers or withholds a rail slot needs both numbers
 * together, and asking for them separately doubled the latency of the pages
 * that do. The database is on the other side of the world from where this is
 * developed, so a round trip costs the better part of a second — cheap in
 * Postgres, expensive on the wire.
 */
export async function getSlotInventory() {
  const rows = await db.execute<{ slots: number | null; booked: number }>(sql`
    select
      (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::int end
        from ${siteSettings} where key = 'sponsor_slots')  as slots,
      (select count(distinct app_id) from ${purchases}
        where kind = 'sponsor' and status = 'active'
          and (current_period_end is null or current_period_end > now()))::int
                                                           as booked
  `)

  const slots = clampSlots(rows[0].slots)
  const booked = rows[0].booked
  return { slots, booked, free: Math.max(0, slots - booked) }
}
