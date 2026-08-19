import { site } from '@/lib/site'

/**
 * Structured data for the pages a search engine has any reason to show
 * specially: the home page, an app, a founder, and a category listing.
 *
 * One rule governs everything here — nothing is described in the markup that
 * the page does not also render for a reader. A rating in JSON-LD that no
 * visitor can see is what gets a site's rich results turned off, and this site's
 * whole claim is that its numbers are checkable.
 */

type Graph = Record<string, unknown>

export const ORGANIZATION_ID = `${site.url}/#organization`
export const WEBSITE_ID = `${site.url}/#website`

function absolute(path: string) {
  return path.startsWith('http') ? path : `${site.url}${path}`
}

/** The publisher, referenced by @id from every other node rather than repeated. */
export function organization(): Graph {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.name,
    url: site.url,
    description: site.description,
    logo: {
      '@type': 'ImageObject',
      url: absolute('/icon-512.png'),
      width: 512,
      height: 512,
    },
  }
}

/**
 * The site itself, plus the search box. `query-input` points at /apps?q=, which
 * is where the header's search actually lands — a SearchAction naming a URL
 * that does not search is worse than none.
 */
export function website(): Graph {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: site.url,
    name: site.name,
    description: site.description,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site.url}/apps?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** Trail of {name, path} from the home page down to, but excluding, self. */
export function breadcrumbs(trail: { name: string; path: string }[]): Graph {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  }
}

export type AppSchemaInput = {
  slug: string
  name: string
  tagline: string | null
  description: string | null
  appStoreUrl: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  priceCents: number | null
  currency: string | null
  averageRating: number | null
  ratingCount: number | null
  primaryGenre: string | null
  releasedAt: Date | null
  founder: { name: string | null; handle: string } | null
}

/**
 * An iOS app as a MobileApplication.
 *
 * The rating is included only when Apple gave us both an average and a count,
 * which is also exactly when the page renders its ratings block. `offers` is
 * always present because free is a price: omitting it would leave a paid app and
 * a free one indistinguishable.
 */
export function mobileApplication(app: AppSchemaInput): Graph {
  const hasRating = app.averageRating != null && app.ratingCount != null && app.ratingCount > 0

  return {
    '@type': 'MobileApplication',
    '@id': `${site.url}/apps/${app.slug}#app`,
    name: app.name,
    url: absolute(`/apps/${app.slug}`),
    description: app.description ?? app.tagline ?? undefined,
    applicationCategory: app.primaryGenre ?? 'MobileApplication',
    operatingSystem: 'iOS',
    image: app.iconUrl ?? undefined,
    screenshot: app.screenshotUrls.length ? app.screenshotUrls.slice(0, 6) : undefined,
    datePublished: app.releasedAt?.toISOString().slice(0, 10),
    installUrl: app.appStoreUrl ?? undefined,
    downloadUrl: app.appStoreUrl ?? undefined,
    offers: {
      '@type': 'Offer',
      price: ((app.priceCents ?? 0) / 100).toFixed(2),
      priceCurrency: app.currency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url: app.appStoreUrl ?? absolute(`/apps/${app.slug}`),
    },
    aggregateRating: hasRating
      ? {
          '@type': 'AggregateRating',
          // Apple's average carries more precision than it earns; one decimal
          // is what the page shows.
          ratingValue: Number(app.averageRating!.toFixed(1)),
          ratingCount: app.ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    author: app.founder
      ? {
          '@type': 'Person',
          name: app.founder.name ?? `@${app.founder.handle}`,
          url: absolute(`/founders/${app.founder.handle}`),
        }
      : undefined,
    isPartOf: { '@id': WEBSITE_ID },
  }
}

/** A founder page: the page is the ProfilePage, the person is its subject. */
export function profilePage(founder: {
  handle: string
  name: string | null
  bio: string | null
  avatarUrl: string | null
  website: string | null
  twitter: string | null
}): Graph {
  const sameAs = [
    founder.website,
    founder.twitter ? `https://x.com/${founder.twitter}` : null,
  ].filter((value): value is string => Boolean(value))

  return {
    '@type': 'ProfilePage',
    '@id': `${site.url}/founders/${founder.handle}#profile`,
    url: absolute(`/founders/${founder.handle}`),
    mainEntity: {
      '@type': 'Person',
      name: founder.name ?? `@${founder.handle}`,
      alternateName: `@${founder.handle}`,
      description: founder.bio ?? undefined,
      image: founder.avatarUrl ?? undefined,
      url: absolute(`/founders/${founder.handle}`),
      sameAs: sameAs.length ? sameAs : undefined,
    },
    isPartOf: { '@id': WEBSITE_ID },
  }
}

/**
 * A ranked list of apps, for the pages that are lists: a category, the
 * leaderboard. Positions are the ranks the page itself displays.
 */
export function itemList(items: { slug: string; name: string }[]): Graph {
  return {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absolute(`/apps/${item.slug}`),
    })),
  }
}

/** Wraps nodes into the single `@graph` a page should emit. */
export function graph(...nodes: (Graph | null | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  }
}
