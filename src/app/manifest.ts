import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

/**
 * Enough of a manifest to make the site installable and to give Android a real
 * icon, no more. There is no offline story here and no app shell to cache, so
 * `display` stays `browser`: a site that is entirely pages should open in a
 * browser, with the address bar the reader uses to check where a revenue number
 * came from.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.shortName} — ${site.tagline}`,
    short_name: site.shortName,
    description: site.description,
    start_url: '/',
    display: 'browser',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
