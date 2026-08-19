import { z } from 'zod'

/**
 * Customer reviews for a listing.
 *
 * Apple's old `/rss/customerreviews/` feed is the documented way to do this and
 * it no longer works — every app id now returns a well-formed feed with zero
 * entries. What still works is the App Store web page itself, which ships the
 * reviews the page renders as a JSON blob in a `<script>` tag.
 *
 * That blob is a private shape, so every field is optional and a parse failure
 * returns nothing rather than throwing: reviews are a nice-to-have on the
 * profile, and the metadata sync they ride along with must not fail over them.
 */
const PAGE_URL = 'https://apps.apple.com'

/** The page serves a different payload to non-browser clients. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** Enough to fill the section without storing an app's whole review history. */
const MAX_REVIEWS = 12

const review = z.object({
  $kind: z.literal('Review'),
  id: z.string(),
  title: z.string().optional(),
  contents: z.string().optional(),
  // Apple sends the star count as a string.
  rating: z.coerce.number().min(1).max(5),
  reviewerName: z.string().optional(),
  date: z.string().optional(),
})

const ratings = z.object({
  $kind: z.literal('Ratings'),
  ratingAverage: z.number().optional(),
  totalNumberOfRatings: z.number().optional(),
  /** Five buckets, 5★ first. Apple sends floats — these are estimates. */
  ratingCounts: z.array(z.number()).length(5).optional(),
})

export type AppStoreReview = {
  reviewId: string
  rating: number
  title: string | null
  body: string | null
  author: string | null
  reviewedAt: Date | null
}

export type AppStoreReviews = {
  reviews: AppStoreReview[]
  /** Ratings per star, 5★ first, or null when the page did not carry them. */
  histogram: number[] | null
}

export async function fetchAppStoreReviews(
  appStoreId: string,
  country = 'us',
): Promise<AppStoreReviews | null> {
  let html: string
  try {
    const response = await fetch(`${PAGE_URL}/${country}/app/id${appStoreId}`, {
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) return null
    html = await response.text()
  } catch {
    return null
  }

  return parseReviewsPage(html)
}

/** Exported for tests: everything after the fetch is pure. */
export function parseReviewsPage(html: string): AppStoreReviews | null {
  const blob = html.match(
    // `[\s\S]` rather than the `s` flag: the build targets an older ES level.
    /<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/,
  )
  if (!blob) return null

  let data: unknown
  try {
    data = JSON.parse(blob[1])
  } catch {
    return null
  }

  /*
   * The reviews shelf is nested differently depending on which modules the page
   * decided to render, and the same review appears under several of them. Walk
   * the whole tree and key by review id rather than guessing at a path that
   * Apple is free to change.
   */
  const byId = new Map<string, AppStoreReview>()
  let histogram: number[] | null = null
  /*
   * Whether the ratings node was there at all, which is the difference between
   * "this app has no reviews" and "this page no longer parses". Apple ships the
   * node on every listing, empty counts and all, so its absence alongside zero
   * reviews means the shape moved — and the caller must retry rather than
   * record the listing as read.
   */
  let sawRatings = false

  walk(data, (node) => {
    const kind = (node as { $kind?: unknown }).$kind

    if (kind === 'Review') {
      const parsed = review.safeParse(node)
      if (parsed.success && !byId.has(parsed.data.id)) {
        byId.set(parsed.data.id, normalize(parsed.data))
      }
      return
    }

    if (kind === 'Ratings' && !histogram) {
      const parsed = ratings.safeParse(node)
      if (parsed.success) sawRatings = true
      // Rounded because Apple's own numbers arrive as 1953.9999999999998.
      const counts = parsed.success ? parsed.data.ratingCounts?.map(Math.round) : undefined
      /*
       * An app nobody has rated comes back as five zeroes. That is not a
       * distribution, it is the absence of one — stored, it would draw five
       * empty bars under "0 ratings" on a brand-new app's profile.
       */
      if (counts && counts.some((count) => count > 0)) histogram = counts
    }
  })

  // An app nobody has reviewed yet is a real, readable answer — returned as an
  // empty list so the caller stores it and stops asking. Only an unrecognisable
  // page returns null.
  if (byId.size === 0 && !sawRatings) return null

  const reviews = [...byId.values()]
    // Newest first; an undated review sorts last rather than to the top.
    .sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))
    .slice(0, MAX_REVIEWS)

  return { reviews, histogram }
}

function walk(node: unknown, visit: (node: object) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (typeof node !== 'object' || node === null) return

  visit(node)
  for (const child of Object.values(node)) walk(child, visit)
}

function normalize(parsed: z.infer<typeof review>): AppStoreReview {
  const date = parsed.date ? new Date(parsed.date) : null

  return {
    reviewId: parsed.id,
    rating: Math.round(parsed.rating),
    title: clean(parsed.title),
    body: clean(parsed.contents),
    author: clean(parsed.reviewerName),
    reviewedAt: date && !Number.isNaN(date.getTime()) ? date : null,
  }
}

function clean(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
