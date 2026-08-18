import 'server-only'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  adminActions,
  appMetrics,
  appStoreMetadata,
  apps,
  profiles,
  purchases,
  revenueConnections,
  siteSettings,
} from '@/db/schema'
import { clampSlots } from '@/lib/settings'
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
/*                                  Purchases                                  */
/* -------------------------------------------------------------------------- */

export type AdminPurchaseRow = Awaited<ReturnType<typeof listAdminPurchases>>[number]

export async function listAdminPurchases({
  status,
  limit = 100,
}: {
  status?: 'pending' | 'active' | 'revoked' | 'superseded'
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
 * Every number on the admin landing page, in one round trip.
 *
 * Deliberately a single statement rather than a `Promise.all` of a dozen tidy
 * little counts. The database is in ap-southeast-2 and this app is developed
 * from the other side of the world, so a round trip costs the better part of a
 * second — eleven of them made this page take half a minute and read as a hang.
 * Postgres computes all of these in well under a millisecond; the only cost that
 * matters is how many times we ask.
 *
 * So: when adding a figure here, add a scalar subquery to this statement. Do not
 * add a second query.
 *
 * `stuckCheckouts` is the one that matters operationally: a pending row is a
 * checkout that was opened and never settled. Some are simply abandoned carts,
 * but a webhook outage looks exactly the same from here, which is why the figure
 * is surfaced rather than buried in a list.
 */
export async function getAdminOverview() {
  const rows = await db.execute<{
    apps_total: number
    apps_live: number
    apps_draft: number
    apps_hidden: number
    apps_verified: number
    users: number
    admins: number
    stuck_checkouts: number
    active_sponsors: number
    active_dofollow: number
    active_gifts: number
    failing_connections: number
    sponsor_slots: number | null
  }>(sql`
    select
      (select count(*) from ${apps})::int                                as apps_total,
      (select count(*) from ${apps} where status = 'live')::int           as apps_live,
      (select count(*) from ${apps} where status = 'draft')::int          as apps_draft,
      (select count(*) from ${apps} where status = 'hidden')::int         as apps_hidden,
      (select count(*) from ${apps} where is_verified)::int               as apps_verified,
      (select count(*) from ${profiles})::int                            as users,
      (select count(*) from ${profiles} where role = 'admin')::int        as admins,
      (select count(*) from ${purchases} where status = 'pending')::int   as stuck_checkouts,
      (select count(distinct app_id) from ${purchases}
        where kind = 'sponsor' and status = 'active'
          and (current_period_end is null or current_period_end > now()))::int
                                                                         as active_sponsors,
      (select count(*) from ${purchases}
        where kind = 'dofollow' and status = 'active')::int               as active_dofollow,
      (select count(*) from ${purchases}
        where source = 'admin' and status = 'active')::int                as active_gifts,
      (select count(*) from ${revenueConnections}
        where status = 'error')::int                                     as failing_connections,
      /*
       * The sponsor-slot setting rides along here instead of costing its own
       * round trip. The jsonb_typeof guard keeps a hand-edited non-numeric value
       * from failing the cast and taking the whole page down; null falls back to
       * the code default once it reaches clampSlots below.
       */
      (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::int end
        from ${siteSettings} where key = 'sponsor_slots')                 as sponsor_slots
  `)

  const r = rows[0]

  return {
    apps: {
      total: r.apps_total,
      live: r.apps_live,
      draft: r.apps_draft,
      hidden: r.apps_hidden,
      verified: r.apps_verified,
    },
    users: r.users,
    admins: r.admins,
    stuckCheckouts: r.stuck_checkouts,
    activeSponsors: r.active_sponsors,
    activeDofollow: r.active_dofollow,
    activeGifts: r.active_gifts,
    failingConnections: r.failing_connections,
    /** Clamped and defaulted exactly as `getSponsorSlots()` would. */
    sponsorSlots: clampSlots(r.sponsor_slots),
  }
}
