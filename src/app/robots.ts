import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /*
       * Signed-in and machine-only surfaces. Everything listed is either behind
       * a session or has no reader — nothing here is useful in an index.
       *
       * /submit is deliberately absent: it needs no account to use and is the
       * page a founder looking to list an app should be able to find, so it is
       * crawled like any other public page.
       *
       * Filtered and searched views of /apps are absent too. They carry
       * `noindex` in their own metadata, and a crawler has to be allowed to
       * fetch a page before it can read that.
       */
      disallow: ['/dashboard', '/account', '/admin', '/login', '/checkout', '/api/', '/auth/'],
    },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
