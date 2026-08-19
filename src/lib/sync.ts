import 'server-only'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import pLimit from 'p-limit'
import { db } from '@/db'
import { appStoreMetadata, apps, revenueConnections } from '@/db/schema'
import { lookupApp } from '@/lib/appstore/lookup'
import { decryptCredentials } from '@/lib/crypto/credentials'
import { writeSnapshot } from '@/lib/data/connections'
import { fetchAppStoreReviews } from '@/lib/appstore/reviews'
import { saveAppStoreMetadata, saveAppStoreReviews } from '@/lib/data/mutations'
import { recomputeAppMetrics } from '@/lib/metrics'
import { getAdapter, ProviderError, type ProviderId } from '@/lib/providers'

/** Failures before a connection is disabled and its owner emailed. */
const FAILURE_BUDGET = 3

/** Concurrency across providers. RevenueCat allows 25 requests/minute per key. */
const CONCURRENCY = 5

export type SyncReport = {
  attempted: number
  succeeded: number
  skipped: number
  failed: number
  disabled: number
  errors: { app: string; provider: string; message: string }[]
}

/**
 * Seeded demo connections carry no real credential. They are skipped rather
 * than failed, so running the sync in development doesn't disable the sample
 * data after three attempts.
 */
function isSampleCredential(credentials: unknown) {
  return (
    typeof credentials === 'object' &&
    credentials !== null &&
    (credentials as { sample?: unknown }).sample === true
  )
}

/**
 * Re-reads every active connection and writes today's snapshot.
 *
 * Ordered by staleness so a partial run always makes progress on the oldest
 * data, and a provider outage never starves the connections behind it.
 */
export async function syncAllRevenue(options: { limit?: number } = {}): Promise<SyncReport> {
  const due = await db
    .select({
      id: revenueConnections.id,
      appId: revenueConnections.appId,
      appSlug: apps.slug,
      appStoreId: apps.appStoreId,
      appName: apps.name,
      bundleId: apps.bundleId,
      provider: revenueConnections.provider,
      credentials: revenueConnections.encryptedCredentials,
      consecutiveFailures: revenueConnections.consecutiveFailures,
    })
    .from(revenueConnections)
    .innerJoin(apps, eq(apps.id, revenueConnections.appId))
    .where(eq(revenueConnections.status, 'active'))
    .orderBy(sql`${revenueConnections.lastSyncedAt} asc nulls first`)
    .limit(options.limit ?? 500)

  const report: SyncReport = {
    attempted: due.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    disabled: 0,
    errors: [],
  }

  const touchedApps = new Set<string>()
  const limit = pLimit(CONCURRENCY)

  await Promise.all(
    due.map((connection) =>
      limit(async () => {
        try {
          const adapter = getAdapter(connection.provider as ProviderId)
          const credentials = decryptCredentials(connection.credentials)

          if (isSampleCredential(credentials)) {
            report.skipped++
            return
          }

          /*
           * The same target the connection was validated against. App Store
           * Connect needs it on every read, not just the first: its report
           * covers the whole vendor account, and without the app to filter on
           * the daily snapshot would drift back to a portfolio total.
           */
          const metrics = await adapter.fetchMetrics(credentials, {
            appStoreId: connection.appStoreId,
            bundleId: connection.bundleId,
            name: connection.appName,
          })

          await writeSnapshot(db, connection.appId, connection.provider as ProviderId, metrics)

          await db
            .update(revenueConnections)
            .set({ lastSyncedAt: new Date(), lastError: null, consecutiveFailures: 0 })
            .where(eq(revenueConnections.id, connection.id))

          touchedApps.add(connection.appId)
          report.succeeded++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          const retryable = error instanceof ProviderError && error.retryable

          // A rate limit or provider outage is not the founder's problem, so it
          // does not spend the failure budget that disables a connection.
          const failures = retryable
            ? connection.consecutiveFailures
            : connection.consecutiveFailures + 1

          const exhausted = failures >= FAILURE_BUDGET

          await db
            .update(revenueConnections)
            .set({
              lastError: message,
              consecutiveFailures: failures,
              status: exhausted ? 'error' : 'active',
            })
            .where(eq(revenueConnections.id, connection.id))

          report.failed++
          if (exhausted) report.disabled++
          report.errors.push({
            app: connection.appSlug,
            provider: connection.provider,
            message,
          })
        }
      }),
    ),
  )

  // Rollups run after every write, so a leaderboard read never sees an app
  // whose snapshot landed but whose summary did not.
  for (const appId of touchedApps) {
    await recomputeAppMetrics(appId)
  }

  return report
}

export type MetadataReport = {
  attempted: number
  updated: number
  missing: number
  /** Listings whose reviews were read for the first time. */
  reviewed: number
  /** Listings left alone because their reviews had already been read. */
  reviewsSkipped: number
}

/**
 * Refreshes App Store facts — icon, rating, version, screenshots. Runs daily;
 * this data changes on Apple's release cadence, not on ours.
 */
export async function syncAppStoreMetadata(
  options: { limit?: number } = {},
): Promise<MetadataReport> {
  const stale = await db
    .select({
      id: apps.id,
      appStoreId: apps.appStoreId,
      reviewsFetchedAt: appStoreMetadata.reviewsFetchedAt,
    })
    .from(apps)
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(and(eq(apps.status, 'live'), isNotNull(apps.appStoreId)))
    .orderBy(sql`${appStoreMetadata.fetchedAt} asc nulls first`)
    .limit(options.limit ?? 200)

  const report: MetadataReport = {
    attempted: stale.length,
    updated: 0,
    missing: 0,
    reviewed: 0,
    reviewsSkipped: 0,
  }

  // Apple's lookup API is generous but unpublished; stay well inside any limit.
  const limit = pLimit(3)

  await Promise.all(
    stale.map((app) =>
      limit(async () => {
        const found = await lookupApp(app.appStoreId).catch(() => null)
        if (!found) {
          report.missing++
          return
        }
        await saveAppStoreMetadata(app.id, found)
        report.updated++

        /*
         * Reviews are scraped from the store page rather than read from the
         * catalogue API — an 800KB request against a shape Apple can change
         * without notice. So it happens once per app, not nightly: a listing
         * already read is skipped, and refreshing one is an explicit admin
         * action. Reviews also move far more slowly than the metadata above.
         *
         * A failed read leaves the stamp unset, so the next run retries it.
         * Nothing here can fail the app: a profile without quoted reviews is
         * fine, one without an icon is not.
         */
        if (app.reviewsFetchedAt) {
          report.reviewsSkipped++
          return
        }

        const reviews = await fetchAppStoreReviews(app.appStoreId).catch(() => null)
        if (reviews) {
          await saveAppStoreReviews(app.id, reviews)
          report.reviewed++
        }
      }),
    ),
  )

  return report
}
