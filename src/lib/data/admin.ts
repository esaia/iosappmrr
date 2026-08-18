import 'server-only'
import { and, count, desc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  adminActions,
  appMetrics,
  appStoreMetadata,
  apps,
  profiles,
  purchases,
  revenueConnections,
} from '@/db/schema'
import { escapeLike } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                  Audit log                                  */
/* -------------------------------------------------------------------------- */

export type AdminActor = { id: string; handle: string }

/**
 * Records one admin action.
 *
 * Called after the write it describes, not before: a log line for something
 * that then failed is worse than a missing one, because it is read as fact.
 * A failure to log is swallowed for the same reason the reverse would be
 * wrong — the action already happened, and throwing here would tell the admin
 * it did not.
 */
export async function logAdminAction(
  actor: AdminActor,
  entry: {
    action: string
    summary: string
    targetType?: 'app' | 'profile' | 'purchase' | 'setting'
    targetId?: string
    detail?: Record<string, unknown>
  },
) {
  try {
    await db.insert(adminActions).values({
      actorId: actor.id,
      actorHandle: actor.handle,
      action: entry.action,
      summary: entry.summary,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      detail: entry.detail ?? {},
    })
  } catch (error) {
    console.error('[admin] failed to write audit entry', entry.action, error)
  }
}

export async function listAdminActions(limit = 50) {
  return db.select().from(adminActions).orderBy(desc(adminActions.createdAt)).limit(limit)
}

/* -------------------------------------------------------------------------- */
/*                                    Apps                                     */
/* -------------------------------------------------------------------------- */

/** A sponsor slot counts as held only while its paid period is still running. */
const sponsorIsLive = or(
  isNull(purchases.currentPeriodEnd),
  gt(purchases.currentPeriodEnd, sql`now()`),
)

export type AdminAppRow = Awaited<ReturnType<typeof listAdminApps>>[number]

/**
 * Every app, in one screen, with the fields an admin acts on.
 *
 * Unlike `listApps` this ignores `status` — the point of the admin list is to
 * see the drafts and hidden listings the public queries deliberately exclude.
 */
export async function listAdminApps({
  q,
  status,
  limit = 100,
}: {
  q?: string
  status?: 'draft' | 'pending' | 'live' | 'hidden'
  limit?: number
}) {
  const filters = []
  if (status) filters.push(eq(apps.status, status))
  if (q?.trim()) {
    const term = `%${escapeLike(q.trim())}%`
    filters.push(or(ilike(apps.name, term), ilike(apps.slug, term), ilike(profiles.handle, term)))
  }

  return db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      status: apps.status,
      isVerified: apps.isVerified,
      websiteDofollow: apps.websiteDofollow,
      website: apps.website,
      createdAt: apps.createdAt,
      founderId: profiles.id,
      founderHandle: profiles.handle,
      iconUrl: appStoreMetadata.iconUrl,
      mrrCents: appMetrics.mrrCents,
      /*
       * Correlated subqueries rather than joins: a join against `purchases`
       * would multiply the app rows by their purchase history, and the counts
       * below would then have to be undone with a group-by over every selected
       * column. These read one indexed row each.
       *
       * Note the interpolation: the table is named, and only the column is
       * written by hand. Interpolating a bare column object instead can emit an
       * unqualified name, because Drizzle only qualifies one when the statement
       * has a join — and the subquery would then resolve it against its own
       * alias rather than the outer row. That compares a row to itself and
       * quietly returns nothing, with no error to notice.
       */
      dofollowSource: sql<string | null>`(
        select p.source from ${purchases} p
        where p.app_id = ${apps}.id and p.kind = 'dofollow' and p.status = 'active'
        order by p.created_at desc limit 1
      )`,
      sponsorSource: sql<string | null>`(
        select p.source from ${purchases} p
        where p.app_id = ${apps}.id and p.kind = 'sponsor' and p.status = 'active'
          and (p.current_period_end is null or p.current_period_end > now())
        order by p.created_at desc limit 1
      )`,
      connectionCount: sql<number>`(
        select count(*)::int from ${revenueConnections} c where c.app_id = ${apps}.id
      )`,
      failingConnections: sql<number>`(
        select count(*)::int from ${revenueConnections} c
        where c.app_id = ${apps}.id and c.status = 'error'
      )`,
    })
    .from(apps)
    .innerJoin(profiles, eq(profiles.id, apps.founderId))
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(apps.createdAt))
    .limit(limit)
}

/** The app an admin action targets, with the founder it belongs to. */
export async function getAdminApp(appId: string) {
  const [row] = await db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      status: apps.status,
      isVerified: apps.isVerified,
      websiteDofollow: apps.websiteDofollow,
      founderId: apps.founderId,
      founderHandle: profiles.handle,
    })
    .from(apps)
    .innerJoin(profiles, eq(profiles.id, apps.founderId))
    .where(eq(apps.id, appId))
    .limit(1)

  return row ?? null
}

/* -------------------------------------------------------------------------- */
/*                                    Users                                    */
/* -------------------------------------------------------------------------- */

export type AdminUserRow = Awaited<ReturnType<typeof listAdminUsers>>[number]

export async function listAdminUsers({ q, limit = 100 }: { q?: string; limit?: number }) {
  const term = q?.trim() ? `%${escapeLike(q.trim())}%` : null

  return db
    .select({
      id: profiles.id,
      handle: profiles.handle,
      name: profiles.name,
      avatarUrl: profiles.avatarUrl,
      twitter: profiles.twitter,
      role: profiles.role,
      createdAt: profiles.createdAt,
      appCount: sql<number>`(select count(*)::int from ${apps} a where a.founder_id = ${profiles}.id)`,
      liveAppCount: sql<number>`(
        select count(*)::int from ${apps} a
        where a.founder_id = ${profiles}.id and a.status = 'live'
      )`,
    })
    .from(profiles)
    .where(term ? or(ilike(profiles.handle, term), ilike(profiles.name, term)) : undefined)
    .orderBy(desc(profiles.createdAt))
    .limit(limit)
}

export async function getProfile(profileId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1)
  return row ?? null
}

/** How many admins exist, used to refuse demoting the last one. */
export async function countAdmins() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.role, 'admin'))

  return row?.count ?? 0
}

/* -------------------------------------------------------------------------- */
/*                                  Purchases                                  */
/* -------------------------------------------------------------------------- */

export type AdminPurchaseRow = Awaited<ReturnType<typeof listAdminPurchases>>[number]

export async function listAdminPurchases({
  status,
  limit = 100,
}: {
  status?: 'pending' | 'active' | 'revoked'
  limit?: number
}) {
  return db
    .select({
      id: purchases.id,
      kind: purchases.kind,
      status: purchases.status,
      source: purchases.source,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      currentPeriodEnd: purchases.currentPeriodEnd,
      polarCheckoutId: purchases.polarCheckoutId,
      polarOrderId: purchases.polarOrderId,
      note: purchases.note,
      createdAt: purchases.createdAt,
      updatedAt: purchases.updatedAt,
      appId: apps.id,
      appName: apps.name,
      appSlug: apps.slug,
      founderHandle: profiles.handle,
    })
    .from(purchases)
    .innerJoin(apps, eq(apps.id, purchases.appId))
    .innerJoin(profiles, eq(profiles.id, purchases.profileId))
    .where(status ? eq(purchases.status, status) : undefined)
    .orderBy(desc(purchases.createdAt))
    .limit(limit)
}

/* -------------------------------------------------------------------------- */
/*                                  Overview                                   */
/* -------------------------------------------------------------------------- */

/**
 * The numbers on the admin landing page.
 *
 * `stuckCheckouts` is the one that matters operationally: a pending row is a
 * checkout that was opened and never settled. Some are simply abandoned carts,
 * but a webhook outage looks exactly the same from here, which is why the
 * figure is surfaced rather than buried in a list.
 */
export async function getAdminOverview() {
  const [
    [appCounts],
    [userCount],
    [adminCount],
    [pendingCount],
    [sponsorCount],
    [dofollowCount],
    [giftCount],
    [failingCount],
  ] = await Promise.all([
    db
      .select({
        total: count(),
        live: sql<number>`count(*) filter (where ${apps.status} = 'live')::int`,
        draft: sql<number>`count(*) filter (where ${apps.status} = 'draft')::int`,
        hidden: sql<number>`count(*) filter (where ${apps.status} = 'hidden')::int`,
        verified: sql<number>`count(*) filter (where ${apps.isVerified})::int`,
      })
      .from(apps),
    db.select({ count: count() }).from(profiles),
    db.select({ count: count() }).from(profiles).where(eq(profiles.role, 'admin')),
    db.select({ count: count() }).from(purchases).where(eq(purchases.status, 'pending')),
    db
      .select({ count: count() })
      .from(purchases)
      .where(and(eq(purchases.kind, 'sponsor'), eq(purchases.status, 'active'), sponsorIsLive)),
    db
      .select({ count: count() })
      .from(purchases)
      .where(and(eq(purchases.kind, 'dofollow'), eq(purchases.status, 'active'))),
    db
      .select({ count: count() })
      .from(purchases)
      .where(and(eq(purchases.source, 'admin'), eq(purchases.status, 'active'))),
    db
      .select({ count: count() })
      .from(revenueConnections)
      .where(eq(revenueConnections.status, 'error')),
  ])

  return {
    apps: appCounts,
    users: userCount.count,
    admins: adminCount.count,
    stuckCheckouts: pendingCount.count,
    activeSponsors: sponsorCount.count,
    activeDofollow: dofollowCount.count,
    activeGifts: giftCount.count,
    failingConnections: failingCount.count,
  }
}
