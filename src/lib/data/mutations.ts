import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { scoreListing } from '@/lib/appstore/aso'
import {
  appStoreMetadata,
  appStoreReviews,
  apps,
  appTechStack,
  revenueConnections,
  techStackTags,
} from '@/db/schema'
import type { AppStoreApp } from '@/lib/appstore/lookup'
import type { AppStoreReviews } from '@/lib/appstore/reviews'
import { slugify } from '@/lib/utils'

/** Finds a free slug, appending a counter only when the natural one is taken. */
export async function uniqueSlug(name: string) {
  const base = slugify(name) || 'app'
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`
    const [existing] = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.slug, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  return `${base}-${Date.now()}`
}

/**
 * Writes the App Store facts for an app. Everything here is derived from
 * Apple's lookup API, so it is replaced wholesale on every refresh rather than
 * merged — a field Apple stops returning should disappear here too.
 */
export async function saveAppStoreMetadata(appId: string, data: AppStoreApp) {
  // Scored here rather than at render time: the description it reads is the one
  // field the lookup returns that this table does not keep.
  const aso = scoreListing(data)

  await db
    .insert(appStoreMetadata)
    .values({
      appId,
      trackName: data.name,
      sellerName: data.sellerName,
      iconUrl: data.iconUrl,
      screenshotUrls: data.screenshotUrls,
      priceCents: data.priceCents,
      currency: data.currency,
      hasInAppPurchases: data.hasInAppPurchases,
      averageRating: data.averageRating,
      ratingCount: data.ratingCount,
      version: data.version,
      primaryGenre: data.primaryGenre,
      genres: data.genres,
      contentRating: data.contentRating,
      releasedAt: data.releasedAt,
      updatedInStoreAt: data.updatedInStoreAt,
      fileSizeBytes: data.fileSizeBytes,
      supportedDevices: data.supportedDevices,
      minimumOsVersion: data.minimumOsVersion,
      asoScore: aso.total,
      asoSignals: aso.signals,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appStoreMetadata.appId,
      set: {
        trackName: data.name,
        sellerName: data.sellerName,
        iconUrl: data.iconUrl,
        screenshotUrls: data.screenshotUrls,
        priceCents: data.priceCents,
        currency: data.currency,
        averageRating: data.averageRating,
        ratingCount: data.ratingCount,
        version: data.version,
        primaryGenre: data.primaryGenre,
        genres: data.genres,
        contentRating: data.contentRating,
        releasedAt: data.releasedAt,
        updatedInStoreAt: data.updatedInStoreAt,
        fileSizeBytes: data.fileSizeBytes,
        supportedDevices: data.supportedDevices,
        minimumOsVersion: data.minimumOsVersion,
        asoScore: aso.total,
        asoSignals: aso.signals,
        fetchedAt: new Date(),
      },
    })
}

/**
 * Replaces an app's stored reviews with what the store shows today, and records
 * the star breakdown that came back with them.
 *
 * Delete-then-insert rather than upsert: these are the reviews Apple currently
 * displays, not an archive, and a review that has been taken down should stop
 * being quoted here too. The histogram is written with an update so it cannot
 * create a metadata row on its own — the lookup owns that row.
 */
export async function saveAppStoreReviews(appId: string, data: AppStoreReviews) {
  await db.transaction(async (tx) => {
    await tx.delete(appStoreReviews).where(eq(appStoreReviews.appId, appId))

    if (data.reviews.length > 0) {
      await tx.insert(appStoreReviews).values(
        data.reviews.map((review) => ({
          appId,
          reviewId: review.reviewId,
          rating: review.rating,
          title: review.title,
          body: review.body,
          author: review.author,
          reviewedAt: review.reviewedAt,
          fetchedAt: new Date(),
        })),
      )
    }

    /*
     * Stamped even when the page carried no histogram and no reviews: this
     * records that the page was read, which is what stops the nightly sync
     * scraping the same listing again. Written with an update so it cannot
     * create a metadata row on its own — the lookup owns that row.
     */
    await tx
      .update(appStoreMetadata)
      .set({ ratingHistogram: data.histogram, reviewsFetchedAt: new Date() })
      .where(eq(appStoreMetadata.appId, appId))
  })
}

export async function setAppTechStack(appId: string, tagSlugs: string[]) {
  await db.delete(appTechStack).where(eq(appTechStack.appId, appId))
  if (tagSlugs.length === 0) return

  const tags = await db
    .select({ id: techStackTags.id })
    .from(techStackTags)
    .where(inArray(techStackTags.slug, tagSlugs))

  if (tags.length === 0) return

  await db
    .insert(appTechStack)
    .values(tags.map((tag) => ({ appId, tagId: tag.id })))
    .onConflictDoNothing()
}

export async function getOwnedApp(appId: string, founderId: string) {
  const [app] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.id, appId), eq(apps.founderId, founderId)))
    .limit(1)
  return app ?? null
}

/** Connection status for the dashboard. Deliberately excludes the credential. */
export async function listConnections(appId: string) {
  return db
    .select({
      id: revenueConnections.id,
      provider: revenueConnections.provider,
      status: revenueConnections.status,
      accountLabel: revenueConnections.accountLabel,
      lastSyncedAt: revenueConnections.lastSyncedAt,
      lastError: revenueConnections.lastError,
    })
    .from(revenueConnections)
    .where(eq(revenueConnections.appId, appId))
}

export async function listAllTechTags() {
  return db.select().from(techStackTags).orderBy(techStackTags.name)
}

/** Founder-written profile copy. Blank strings are stored as null so the
 * profile page can treat "not filled in" and "cleared" identically. */
export async function updateAppInsights(
  appId: string,
  values: {
    valueProposition: string | null
    problemSolved: string | null
    audience: string | null
    audienceType: 'B2C' | 'B2B' | 'B2B2C' | null
    marketTags: string[]
    marketingChannels: string[]
    additionalInfo: string | null
  },
) {
  await db
    .update(apps)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(apps.id, appId))
}

/**
 * Core listing details a founder can change after submitting.
 *
 * `websiteDofollow` is absent by design: it is a paid benefit, written only by
 * the Polar webhook in `lib/data/purchases.ts`. Keeping it out of this type
 * means a founder-facing form cannot set it even by accident.
 */
export async function updateAppDetails(
  appId: string,
  values: {
    name: string
    tagline: string | null
    description: string | null
    categoryId: string | null
    website: string | null
  },
) {
  await db
    .update(apps)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(apps.id, appId))
}

/**
 * Removes a listing outright. Snapshots, connections, metrics and tech links
 * all cascade from apps, so this leaves nothing orphaned — and nothing
 * recoverable, which is why the UI confirms by name.
 */
export async function deleteApp(appId: string) {
  await db.delete(apps).where(eq(apps.id, appId))
}
