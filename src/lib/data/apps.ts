import { escapeLike } from '@/lib/utils'
import 'server-only'
import { and, asc, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  appMetrics,
  appStoreMetadata,
  apps,
  appTechStack,
  categories,
  profiles,
  revenueSnapshots,
  techStackTags,
} from '@/db/schema'

export type AppSort = 'mrr' | 'growth' | 'newest' | 'name'

export type AppListing = {
  id: string
  slug: string
  name: string
  tagline: string | null
  iconUrl: string | null
  categoryName: string | null
  categorySlug: string | null
  founderHandle: string | null
  founderName: string | null
  mrrCents: number
  growth30d: number | null
  sparkline: number[]
  providers: string[]
  dataAsOf: string | null
  averageRating: number | null
  ratingCount: number | null
}

/**
 * The one query behind every list on the site. Reads `app_metrics` rather than
 * aggregating snapshots, so adding a filter never turns into a table scan of
 * the full revenue history.
 */
export async function listApps(
  options: {
    sort?: AppSort
    categorySlug?: string
    techSlug?: string
    search?: string
    minMrrCents?: number
    limit?: number
    offset?: number
  } = {},
) {
  const { sort = 'mrr', limit = 50, offset = 0 } = options

  const filters = [eq(apps.status, 'live')]

  if (options.categorySlug) filters.push(eq(categories.slug, options.categorySlug))
  if (options.minMrrCents) filters.push(gte(appMetrics.mrrCents, options.minMrrCents))

  if (options.search) {
    const term = `%${escapeLike(options.search)}%`
    filters.push(or(ilike(apps.name, term), ilike(apps.tagline, term))!)
  }

  if (options.techSlug) {
    filters.push(
      sql`exists (
        select 1 from ${appTechStack}
        join ${techStackTags} on ${techStackTags.id} = ${appTechStack.tagId}
        where ${appTechStack.appId} = ${apps.id} and ${techStackTags.slug} = ${options.techSlug}
      )`,
    )
  }

  // Apps without metrics sort last on every revenue-based ordering rather than
  // appearing as $0 at the top of an ascending list.
  const orderBy = {
    mrr: [desc(sql`coalesce(${appMetrics.mrrCents}, 0)`)],
    // Postgres sorts NULLs first on DESC; an app with no history yet
    // must not outrank one that is actually growing.
    growth: [sql`${appMetrics.growth30d} desc nulls last`],
    newest: [desc(apps.createdAt)],
    name: [asc(apps.name)],
  }[sort]

  const rows = await db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      tagline: apps.tagline,
      iconUrl: appStoreMetadata.iconUrl,
      averageRating: appStoreMetadata.averageRating,
      ratingCount: appStoreMetadata.ratingCount,
      categoryName: categories.name,
      categorySlug: categories.slug,
      founderHandle: profiles.handle,
      founderName: profiles.name,
      mrrCents: appMetrics.mrrCents,
      growth30d: appMetrics.growth30d,
      sparkline: appMetrics.sparkline,
      providers: appMetrics.providers,
      dataAsOf: appMetrics.dataAsOf,
    })
    .from(apps)
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .leftJoin(categories, eq(categories.id, apps.categoryId))
    .leftJoin(profiles, eq(profiles.id, apps.founderId))
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset)

  return rows.map(toListing)
}

function toListing(row: Record<string, unknown>): AppListing {
  return {
    ...(row as AppListing),
    mrrCents: Number(row.mrrCents ?? 0),
    sparkline: (row.sparkline as number[] | null) ?? [],
    providers: (row.providers as string[] | null) ?? [],
  }
}

export async function countApps(options: { categorySlug?: string; search?: string } = {}) {
  const filters = [eq(apps.status, 'live')]
  if (options.categorySlug) filters.push(eq(categories.slug, options.categorySlug))
  if (options.search) {
    const term = `%${escapeLike(options.search)}%`
    filters.push(or(ilike(apps.name, term), ilike(apps.tagline, term))!)
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apps)
    .leftJoin(categories, eq(categories.id, apps.categoryId))
    .where(and(...filters))

  return row?.count ?? 0
}

/** Full detail for `/apps/[slug]`. Returns null for drafts and unknown slugs. */
export async function getAppBySlug(slug: string) {
  const [row] = await db
    .select({
      app: apps,
      metadata: appStoreMetadata,
      metrics: appMetrics,
      category: categories,
      founder: profiles,
    })
    .from(apps)
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .leftJoin(categories, eq(categories.id, apps.categoryId))
    .leftJoin(profiles, eq(profiles.id, apps.founderId))
    .where(and(eq(apps.slug, slug), eq(apps.status, 'live')))
    .limit(1)

  if (!row) return null

  const tech = await db
    .select({ slug: techStackTags.slug, name: techStackTags.name, kind: techStackTags.kind })
    .from(appTechStack)
    .innerJoin(techStackTags, eq(techStackTags.id, appTechStack.tagId))
    .where(eq(appTechStack.appId, row.app.id))
    .orderBy(asc(techStackTags.name))

  return { ...row, tech }
}

/** Daily totals for the app profile chart, oldest first. One row per day, summed
 * across providers, carrying every series the chart can plot. */
export async function getRevenueHistory(appId: string, days = 180) {
  const rows = await db
    .select({
      date: revenueSnapshots.capturedOn,
      mrrCents: sql<string>`sum(${revenueSnapshots.mrrCents})`,
      // Null stays null: a provider that never reports subscriptions should read
      // as "no data", not as zero subscribers.
      activeSubscriptions: sql<string | null>`sum(${revenueSnapshots.activeSubscriptions})`,
      activeTrials: sql<string | null>`sum(${revenueSnapshots.activeTrials})`,
      revenue28dCents: sql<string | null>`sum(${revenueSnapshots.revenue28dCents})`,
    })
    .from(revenueSnapshots)
    .where(
      and(
        eq(revenueSnapshots.appId, appId),
        gte(revenueSnapshots.capturedOn, sql`current_date - ${days}::int`),
      ),
    )
    .groupBy(revenueSnapshots.capturedOn)
    .orderBy(asc(revenueSnapshots.capturedOn))

  const num = (v: string | null) => (v == null ? null : Number(v))

  return rows.map((row) => ({
    date: row.date,
    mrrCents: Number(row.mrrCents),
    activeSubscriptions: num(row.activeSubscriptions),
    activeTrials: num(row.activeTrials),
    revenue28dCents: num(row.revenue28dCents),
  }))
}

export async function listCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      appCount: sql<number>`count(${apps.id})::int`,
      totalMrrCents: sql<string>`coalesce(sum(${appMetrics.mrrCents}), 0)`,
    })
    .from(categories)
    .leftJoin(apps, and(eq(apps.categoryId, categories.id), eq(apps.status, 'live')))
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder))
}

export async function listTechTags() {
  return db
    .select({
      slug: techStackTags.slug,
      name: techStackTags.name,
      kind: techStackTags.kind,
      appCount: sql<number>`count(distinct ${apps.id})::int`,
    })
    .from(techStackTags)
    .leftJoin(appTechStack, eq(appTechStack.tagId, techStackTags.id))
    .leftJoin(apps, and(eq(apps.id, appTechStack.appId), eq(apps.status, 'live')))
    .groupBy(techStackTags.id)
    .orderBy(desc(sql`count(distinct ${apps.id})`))
}

/**
 * Aggregate figures for the homepage strip and `/stats`. Deliberately counts
 * only verified apps — an unverified total would undercut the whole premise.
 */
export async function getEcosystemStats() {
  const [row] = await db
    .select({
      appCount: sql<number>`count(distinct ${apps.id})::int`,
      totalMrrCents: sql<string>`coalesce(sum(${appMetrics.mrrCents}), 0)`,
      medianMrrCents: sql<string>`coalesce(percentile_cont(0.5) within group (order by ${appMetrics.mrrCents}), 0)`,
      founderCount: sql<number>`count(distinct ${apps.founderId})::int`,
    })
    .from(apps)
    .innerJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .where(and(eq(apps.status, 'live'), eq(apps.isVerified, true)))

  return {
    appCount: row?.appCount ?? 0,
    totalMrrCents: Number(row?.totalMrrCents ?? 0),
    medianMrrCents: Number(row?.medianMrrCents ?? 0),
    founderCount: row?.founderCount ?? 0,
  }
}

/**
 * The homepage sync tape: which apps refreshed most recently. This is the claim
 * "updated hourly" made visible, so it reads from the connections themselves
 * rather than a cached summary.
 */
export async function getRecentSyncs(limit = 12) {
  const rows = await db.execute<{
    slug: string
    name: string
    icon_url: string | null
    provider: string
    last_synced_at: string
    mrr_cents: string | null
  }>(sql`
    select distinct on (a.id)
      a.slug, a.name, m.icon_url, c.provider::text as provider,
      c.last_synced_at, am.mrr_cents
    from revenue_connections c
    join apps a on a.id = c.app_id and a.status = 'live'
    left join app_store_metadata m on m.app_id = a.id
    left join app_metrics am on am.app_id = a.id
    where c.status = 'active' and c.last_synced_at is not null
    order by a.id, c.last_synced_at desc
    limit ${limit}
  `)

  return rows
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      iconUrl: row.icon_url,
      provider: row.provider,
      lastSyncedAt: new Date(row.last_synced_at),
      mrrCents: Number(row.mrr_cents ?? 0),
    }))
    .sort((a, b) => b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime())
}

/** A founder's public page: their profile plus every live app they own. */
export async function getFounderByHandle(handle: string) {
  const [founder] = await db.select().from(profiles).where(eq(profiles.handle, handle)).limit(1)
  if (!founder) return null

  const rows = await db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      tagline: apps.tagline,
      iconUrl: appStoreMetadata.iconUrl,
      averageRating: appStoreMetadata.averageRating,
      ratingCount: appStoreMetadata.ratingCount,
      categoryName: categories.name,
      categorySlug: categories.slug,
      founderHandle: profiles.handle,
      founderName: profiles.name,
      mrrCents: appMetrics.mrrCents,
      growth30d: appMetrics.growth30d,
      sparkline: appMetrics.sparkline,
      providers: appMetrics.providers,
      dataAsOf: appMetrics.dataAsOf,
    })
    .from(apps)
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .leftJoin(categories, eq(categories.id, apps.categoryId))
    .leftJoin(profiles, eq(profiles.id, apps.founderId))
    .where(and(eq(apps.founderId, founder.id), eq(apps.status, 'live')))
    .orderBy(desc(sql`coalesce(${appMetrics.mrrCents}, 0)`))

  return { founder, apps: rows.map(toListing) }
}
