import { getAppBySlug } from '@/lib/data/apps'
import { badgeEmbedDocument, parseBadgeTheme } from '@/lib/embed-badge'

/**
 * The badge as a page, for the iframe snippet.
 *
 * A route handler rather than a page so it escapes the root layout: what an
 * iframe this size can show is the badge, and nothing else — no header, no
 * font preload, no analytics script running in a stranger's page.
 *
 * The document is a link around the same PNG the linked-image snippet uses, so
 * both embeds are the same artwork and there is one place it is drawn.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const theme = parseBadgeTheme(new URL(request.url).searchParams.get('theme'))

  const record = await getAppBySlug(slug)
  if (!record) return new Response('Not found', { status: 404 })

  return new Response(badgeEmbedDocument(slug, record.app.name, theme), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Matches the PNG it wraps: the markup only changes when the app's name
      // does, and the figure inside it is the image's business, not this
      // document's.
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
