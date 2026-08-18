import { z } from 'zod'

/**
 * Apple's public iTunes Search API. No key, no auth, generous limits — this is
 * what lets a founder paste one URL and get a fully populated listing.
 *
 * Undocumented but stable for many years; treat every field as optional.
 */
const LOOKUP_URL = 'https://itunes.apple.com/lookup'

const lookupResult = z.object({
  trackId: z.number(),
  trackName: z.string().optional(),
  bundleId: z.string().optional(),
  sellerName: z.string().optional(),
  artistName: z.string().optional(),
  description: z.string().optional(),
  artworkUrl512: z.string().optional(),
  artworkUrl100: z.string().optional(),
  screenshotUrls: z.array(z.string()).optional(),
  ipadScreenshotUrls: z.array(z.string()).optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  averageUserRating: z.number().optional(),
  userRatingCount: z.number().optional(),
  version: z.string().optional(),
  primaryGenreName: z.string().optional(),
  genres: z.array(z.string()).optional(),
  contentAdvisoryRating: z.string().optional(),
  releaseDate: z.string().optional(),
  currentVersionReleaseDate: z.string().optional(),
  fileSizeBytes: z.string().optional(),
  supportedDevices: z.array(z.string()).optional(),
  minimumOsVersion: z.string().optional(),
  sellerUrl: z.string().optional(),
  trackViewUrl: z.string().optional(),
  kind: z.string().optional(),
})

const lookupResponse = z.object({
  resultCount: z.number(),
  results: z.array(z.unknown()),
})

export type AppStoreApp = {
  appStoreId: string
  name: string
  bundleId: string | null
  sellerName: string | null
  description: string | null
  iconUrl: string | null
  screenshotUrls: string[]
  priceCents: number | null
  currency: string | null
  hasInAppPurchases: boolean | null
  averageRating: number | null
  ratingCount: number | null
  version: string | null
  primaryGenre: string | null
  genres: string[]
  contentRating: string | null
  releasedAt: Date | null
  updatedInStoreAt: Date | null
  fileSizeBytes: number | null
  supportedDevices: string[]
  minimumOsVersion: string | null
  website: string | null
  appStoreUrl: string | null
}

export class AppStoreLookupError extends Error {}

/**
 * Pulls the numeric Apple ID out of anything a founder is likely to paste:
 * a full App Store URL, a share link, or the bare ID.
 */
export function parseAppStoreId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d{6,12}$/.test(trimmed)) return trimmed

  // https://apps.apple.com/us/app/things-3/id904237743?mt=8
  const fromUrl = trimmed.match(/\/id(\d{6,12})/)
  if (fromUrl) return fromUrl[1]

  // Older itunes.apple.com links use a query parameter.
  const fromQuery = trimmed.match(/[?&]id=(\d{6,12})/)
  if (fromQuery) return fromQuery[1]

  return null
}

export async function lookupApp(appStoreId: string, country = 'us'): Promise<AppStoreApp | null> {
  const params = new URLSearchParams({ id: appStoreId, country, entity: 'software' })

  let response: Response
  try {
    response = await fetch(`${LOOKUP_URL}?${params}`, {
      // Apple's CDN caches these heavily; a day is plenty for store metadata.
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (cause) {
    throw new AppStoreLookupError('Could not reach the App Store.', { cause })
  }

  if (!response.ok) {
    throw new AppStoreLookupError(`The App Store returned ${response.status}.`)
  }

  const body = lookupResponse.safeParse(await response.json())
  if (!body.success || body.data.resultCount === 0) return null

  const parsed = lookupResult.safeParse(body.data.results[0])
  if (!parsed.success) return null

  return normalize(parsed.data)
}

function normalize(result: z.infer<typeof lookupResult>): AppStoreApp {
  const screenshots = [...(result.screenshotUrls ?? []), ...(result.ipadScreenshotUrls ?? [])]

  return {
    appStoreId: String(result.trackId),
    name: result.trackName ?? 'Untitled app',
    bundleId: result.bundleId ?? null,
    sellerName: result.sellerName ?? result.artistName ?? null,
    description: result.description ?? null,
    // Ask Apple's CDN for a crisp icon rather than the 100px default.
    iconUrl: upscaleArtwork(result.artworkUrl512 ?? result.artworkUrl100 ?? null),
    screenshotUrls: screenshots.slice(0, 8),
    priceCents: result.price === undefined ? null : Math.round(result.price * 100),
    currency: result.currency ?? null,
    // The lookup API does not expose an IAP flag, but a free app with a
    // non-zero rating count and no price is the common freemium shape. Leave it
    // unknown rather than guess wrong.
    hasInAppPurchases: null,
    averageRating: result.averageUserRating ?? null,
    ratingCount: result.userRatingCount ?? null,
    version: result.version ?? null,
    primaryGenre: result.primaryGenreName ?? null,
    genres: result.genres ?? [],
    contentRating: result.contentAdvisoryRating ?? null,
    releasedAt: toDate(result.releaseDate),
    updatedInStoreAt: toDate(result.currentVersionReleaseDate),
    fileSizeBytes: result.fileSizeBytes ? Number(result.fileSizeBytes) : null,
    supportedDevices: result.supportedDevices ?? [],
    minimumOsVersion: result.minimumOsVersion ?? null,
    website: result.sellerUrl ?? null,
    appStoreUrl: result.trackViewUrl ?? `https://apps.apple.com/app/id${result.trackId}`,
  }
}

/** Apple serves any size from the same path; 512 is enough for a retina icon. */
function upscaleArtwork(url: string | null) {
  if (!url) return null
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/512x512bb.$1')
}

function toDate(value: string | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
