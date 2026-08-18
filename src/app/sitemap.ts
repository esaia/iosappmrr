import type { MetadataRoute } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, profiles } from '@/db/schema'
import { listCategories } from '@/lib/data/apps'
import { site } from '@/lib/site'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [liveApps, categories, founders] = await Promise.all([
    db
      .select({ slug: apps.slug, updatedAt: apps.updatedAt })
      .from(apps)
      .where(eq(apps.status, 'live')),
    listCategories(),
    db.select({ handle: profiles.handle, updatedAt: profiles.updatedAt }).from(profiles),
  ])

  const staticPages = [
    '',
    '/leaderboard',
    '/apps',
    '/categories',
    '/stats',
    '/verification',
    '/about',
  ]

  return [
    ...staticPages.map((path) => ({
      url: `${site.url}${path}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: path === '' ? 1 : 0.8,
    })),
    ...liveApps.map((app) => ({
      url: `${site.url}/apps/${app.slug}`,
      lastModified: app.updatedAt,
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
