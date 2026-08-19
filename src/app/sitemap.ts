import type { MetadataRoute } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appMetrics, apps, profiles } from '@/db/schema'
import { listCategories } from '@/lib/data/apps'
import { site } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [liveApps, categories, founders] = await Promise.all([
    /*
     * Both timestamps, because an app page's `lastModified` is the later of
     * them. `apps.updatedAt` moves only when a founder edits the listing, while
     * the figure the page is built around is rewritten by the nightly revenue
     * sync. Reporting the edit date alone would tell a crawler the page had
     * been untouched for months on exactly the pages that change every day.
     *
     * The comparison is done below in JS rather than as a `greatest()` in SQL:
     * a raw SQL expression comes back as the driver's own string, and the
     * `<lastmod>` that produces is not the ISO 8601 the sitemap spec requires.
     */
    db
      .select({
        slug: apps.slug,
        updatedAt: apps.updatedAt,
        metricsUpdatedAt: appMetrics.updatedAt,
      })
      .from(apps)
      .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
      .where(eq(apps.status, 'live')),
    listCategories(),
    db.select({ handle: profiles.handle, updatedAt: profiles.updatedAt }).from(profiles),
  ])

  /*
   * Ordered roughly by how much of the site each one opens up, which is also
   * the order the priorities below follow. Only pages a stranger can read are
   * listed — nothing behind a session belongs in a sitemap, and a URL that is
   * disallowed in robots.txt would be a contradiction rather than a hint.
   */
  const staticPages = [
    '',
    '/leaderboard',
    '/apps',
    '/categories',
    '/stats',
    '/verification',
    '/submit',
    '/about',
    '/marketplace',
    '/privacy',
    '/terms',
  ]

  return [
    ...staticPages.map((path) => {
      // Honest frequencies. A sitemap that claims every page changes daily,
      // including the terms, teaches crawlers to disregard the whole file.
      const rarely = ['/about', '/privacy', '/terms', '/marketplace', '/verification'].includes(
        path,
      )
      return {
        url: `${site.url}${path}`,
        lastModified: new Date(),
        changeFrequency: rarely ? ('monthly' as const) : ('daily' as const),
        priority: path === '' ? 1 : rarely ? 0.4 : 0.8,
      }
    }),
    ...liveApps.map((app) => ({
      url: `${site.url}/apps/${app.slug}`,
      lastModified:
        app.metricsUpdatedAt && app.metricsUpdatedAt > app.updatedAt
          ? app.metricsUpdatedAt
          : app.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...categories.map((category) => ({
      url: `${site.url}/categories/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...founders.map((founder) => ({
      url: `${site.url}/founders/${founder.handle}`,
      lastModified: founder.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ]
}
