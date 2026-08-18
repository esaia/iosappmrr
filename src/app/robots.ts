import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private surfaces. Nothing here is useful in an index.
      disallow: ['/dashboard', '/submit', '/login', '/admin', '/api/', '/auth/'],
    },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
