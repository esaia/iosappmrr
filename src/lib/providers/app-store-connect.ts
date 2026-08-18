import { gunzipSync } from 'node:zlib'
import { importPKCS8, SignJWT } from 'jose'
import { z } from 'zod'
import {
  ProviderError,
  type NormalizedMetrics,
  type ProviderAdapter,
  type ValidationResult,
} from './types'

const API_BASE = 'https://api.appstoreconnect.apple.com/v1'

export const appStoreConnectCredentials = z.object({
  issuerId: z.string().trim().uuid('Issuer ID is the UUID shown above the keys table.'),
  keyId: z.string().trim().min(6, 'Key ID is required.'),
  /** Contents of the AuthKey_XXXXXXXX.p8 file, including the BEGIN/END lines. */
  privateKey: z
    .string()
    .trim()
    .refine(
      (v) => v.includes('BEGIN PRIVATE KEY'),
      'Paste the whole .p8 file, including the header.',
    ),
  /** Found in App Store Connect under Payments and Financial Reports. */
  vendorNumber: z
    .string()
    .trim()
    .regex(/^\d{6,12}$/, 'Vendor number is 6–12 digits.'),
})

export type AppStoreConnectCredentials = z.infer<typeof appStoreConnectCredentials>

/** ASC tokens are short-lived by policy; 20 minutes is the documented maximum. */
async function mintToken(credentials: AppStoreConnectCredentials) {
  let key: CryptoKey | Uint8Array
  try {
    key = await importPKCS8(credentials.privateKey, 'ES256')
  } catch (cause) {
    throw new ProviderError('That .p8 private key could not be read.', { cause })
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: credentials.keyId, typ: 'JWT' })
    .setIssuer(credentials.issuerId)
    .setIssuedAt()
    .setExpirationTime('19m')
    .setAudience('appstoreconnect-v1')
    .sign(key)
}

/**
 * Apple publishes daily reports the following day, and there is no report at
 * all for a day with no sales. Walk back from yesterday until we find one.
 */
const MAX_LOOKBACK_DAYS = 5

async function fetchLatestSubscriptionReport(credentials: AppStoreConnectCredentials) {
  const token = await mintToken(credentials)

  for (let daysAgo = 1; daysAgo <= MAX_LOOKBACK_DAYS; daysAgo++) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - daysAgo)
    const reportDate = day.toISOString().slice(0, 10)

    const params = new URLSearchParams({
      'filter[frequency]': 'DAILY',
      'filter[reportType]': 'SUBSCRIPTION',
      'filter[reportSubType]': 'SUMMARY',
      'filter[vendorNumber]': credentials.vendorNumber,
      'filter[reportDate]': reportDate,
      'filter[version]': '1_4',
    })

    let response: Response
    try {
      response = await fetch(`${API_BASE}/salesReports?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' },
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })
    } catch (cause) {
      throw new ProviderError('Could not reach App Store Connect.', { retryable: true, cause })
    }

    // No report for that day. Not an error — try the day before.
    if (response.status === 404) continue

    if (response.status === 401) {
      throw new ProviderError(
        'App Store Connect rejected this key. Check the issuer ID, key ID, and that the ' +
          'key still exists and has at least Sales and Reports access.',
      )
    }

    if (response.status === 403) {
      throw new ProviderError(
        'This key does not have permission to read sales reports. In App Store Connect, ' +
          'give it the Sales and Reports role.',
      )
    }

    if (response.status === 429) {
      throw new ProviderError('App Store Connect is rate limiting this key.', { retryable: true })
    }

    if (!response.ok) {
      throw new ProviderError(`App Store Connect returned ${response.status}.`, { retryable: true })
    }

    const gzipped = Buffer.from(await response.arrayBuffer())
    let tsv: string
    try {
      tsv = gunzipSync(gzipped).toString('utf8')
    } catch (cause) {
      throw new ProviderError('App Store Connect returned an unreadable report.', {
        retryable: true,
        cause,
      })
    }

    return { tsv, reportDate }
  }

  throw new ProviderError(
    `No sales report published in the last ${MAX_LOOKBACK_DAYS} days. If the app has no ` +
      'subscribers yet, Apple publishes nothing — connect RevenueCat instead, or try again ' +
      'once you have sales.',
  )
}

/**
 * Apple's subscription report is a tab-separated file with a header row. Each
 * row is one subscription offer in one territory, with an active count and the
 * proceeds Apple pays out. We sum proceeds normalised to a monthly value.
 */
export function parseSubscriptionReport(tsv: string): {
  mrrCents: number
  activeSubscriptions: number
  currency: string
} {
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    return { mrrCents: 0, activeSubscriptions: 0, currency: 'USD' }
  }

  const header = lines[0].split('\t').map((h) => h.trim())
  const columnIndex = (...candidates: string[]) => {
    for (const candidate of candidates) {
      const index = header.findIndex((h) => h.toLowerCase() === candidate.toLowerCase())
      if (index !== -1) return index
    }
    return -1
  }

  const durationIdx = columnIndex('Standard Subscription Duration', 'Subscription Duration')
  const activeIdx = columnIndex('Active Standard Price Subscriptions', 'Active Subscriptions')
  const trialIdx = columnIndex('Active Free Trial Introductory Offer Subscriptions')
  // Gross customer price, to match how RevenueCat reports MRR. Falling back to
  // developer proceeds would understate an app by Apple's 15-30% cut.
  const priceIdx = columnIndex('Customer Price', 'Developer Proceeds')
  const currencyIdx = columnIndex('Customer Currency', 'Proceeds Currency', 'Currency')

  let mrrCents = 0
  let activeSubscriptions = 0
  let currency = 'USD'

  for (const line of lines.slice(1)) {
    const cells = line.split('\t')

    const active = toNumber(cells[activeIdx])
    activeSubscriptions += active

    if (currencyIdx !== -1 && cells[currencyIdx]?.trim()) {
      currency = cells[currencyIdx].trim().toUpperCase()
    }

    const price = toNumber(cells[priceIdx])
    if (!price || !active) continue

    mrrCents += Math.round(price * 100 * active * monthlyFactor(cells[durationIdx]))

    // Trials contribute nothing to MRR, but we still count the seats.
    if (trialIdx !== -1) activeSubscriptions += toNumber(cells[trialIdx])
  }

  return { mrrCents, activeSubscriptions, currency }
}

/** Normalises any subscription term to its share of one month. */
function monthlyFactor(duration: string | undefined) {
  const value = (duration ?? '').trim().toLowerCase()
  if (value.includes('1 year') || value.includes('year')) return 1 / 12
  if (value.includes('6 month')) return 1 / 6
  if (value.includes('3 month')) return 1 / 3
  if (value.includes('2 month')) return 1 / 2
  if (value.includes('1 week') || value.includes('week')) return 52 / 12
  return 1
}

function toNumber(cell: string | undefined) {
  if (!cell) return 0
  const parsed = Number(cell.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export const appStoreConnectAdapter: ProviderAdapter<AppStoreConnectCredentials> = {
  id: 'app_store_connect',
  name: 'App Store Connect',
  docsUrl: 'https://developer.apple.com/documentation/appstoreconnectapi/get-v1-salesreports',
  instructions:
    'In App Store Connect, go to Users and Access → Integrations → App Store Connect API and ' +
    'create a key with the Sales and Reports role. Download the .p8 file — Apple only lets you ' +
    'download it once. Your vendor number is on the Payments and Financial Reports page. ' +
    'Apple publishes sales data a day behind, so figures from this source lag by one day.',
  schema: appStoreConnectCredentials,

  async validate(credentials): Promise<ValidationResult> {
    const metrics = await this.fetchMetrics(credentials)
    return { accountLabel: `Vendor ${credentials.vendorNumber}`, metrics }
  },

  async fetchMetrics(credentials): Promise<NormalizedMetrics> {
    const { tsv, reportDate } = await fetchLatestSubscriptionReport(credentials)
    const parsed = parseSubscriptionReport(tsv)

    return {
      mrrCents: parsed.mrrCents,
      currency: parsed.currency,
      activeSubscriptions: parsed.activeSubscriptions,
      capturedOn: new Date(`${reportDate}T00:00:00Z`),
    }
  },
}
