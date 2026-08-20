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

/**
 * Walks back to the newest report this account published, parsed for one app.
 *
 * `requireMatch` is the ownership test. With it on, a report that exists but
 * names other apps is treated like no report at all and the walk continues —
 * so the only way to finish is with a day on which Apple itself attributed
 * subscriptions for this App Store ID to this vendor account. That is a fact
 * about Apple's records rather than a claim by whoever filled in the form,
 * which is what makes App Store Connect the strongest source here.
 */
async function fetchLatestSubscriptionReport(
  credentials: AppStoreConnectCredentials,
  appStoreId: string,
  requireMatch: boolean,
) {
  const token = await mintToken(credentials)

  for (let daysAgo = 1; daysAgo <= MAX_LOOKBACK_DAYS; daysAgo++) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - daysAgo)
    const reportDate = day.toISOString().slice(0, 10)

    const tsv = await fetchReport(token, {
      'filter[frequency]': 'DAILY',
      'filter[reportType]': 'SUBSCRIPTION',
      'filter[reportSubType]': 'SUMMARY',
      'filter[vendorNumber]': credentials.vendorNumber,
      'filter[reportDate]': reportDate,
      'filter[version]': '1_4',
    })

    // No report for that day. Not an error — try the day before.
    if (tsv === null) continue

    const parsed = parseSubscriptionReport(tsv, appStoreId)

    // A report full of other apps is not this app's report.
    if (requireMatch && parsed.rows === 0) continue

    return { parsed, reportDate, token }
  }

  if (requireMatch) {
    throw new ProviderError(
      `This App Store Connect account published sales in the last ${MAX_LOOKBACK_DAYS} days, ` +
        'but none of them are for this app. Either the account does not ship it, or it has no ' +
        'subscribers yet — in which case connect RevenueCat instead, or try again once you ' +
        'have sales.',
    )
  }

  throw new ProviderError(
    `No sales report published in the last ${MAX_LOOKBACK_DAYS} days. If the app has no ` +
      'subscribers yet, Apple publishes nothing — connect RevenueCat instead, or try again ' +
      'once you have sales.',
  )
}

/**
 * One report, unzipped to text. Returns null for a day Apple published nothing
 * on, which is an ordinary answer rather than a failure: there is no report for
 * a day with no activity, and the callers decide what that means.
 */
async function fetchReport(token: string, params: Record<string, string>) {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/salesReports?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/a-gzip' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
  } catch (cause) {
    throw new ProviderError('Could not reach App Store Connect.', { retryable: true, cause })
  }

  if (response.status === 404) return null

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
  try {
    return gunzipSync(gzipped).toString('utf8')
  } catch (cause) {
    throw new ProviderError('App Store Connect returned an unreadable report.', {
      retryable: true,
      cause,
    })
  }
}

/**
 * Downloads on one day, from the SALES report that runs beside the subscription
 * one. Read for the day the subscription figures came from, so a snapshot never
 * mixes two dates.
 *
 * Null, not zero, when Apple published no sales report for that day: an app can
 * hold subscribers through a day nobody installed it, but it can equally be a
 * day Apple simply has nothing for, and the chart draws a gap rather than a
 * floor for the second case.
 */
async function fetchInstalls(
  token: string,
  credentials: AppStoreConnectCredentials,
  appStoreId: string,
  reportDate: string,
) {
  const tsv = await fetchReport(token, {
    'filter[frequency]': 'DAILY',
    'filter[reportType]': 'SALES',
    'filter[reportSubType]': 'SUMMARY',
    'filter[vendorNumber]': credentials.vendorNumber,
    'filter[reportDate]': reportDate,
    'filter[version]': '1_1',
  })

  if (tsv === null) return undefined

  return parseInstalls(tsv, appStoreId).installs
}

/**
 * Units from Apple's SALES report that are a person getting the app for the
 * first time.
 *
 * The file is one row per SKU, territory and transaction kind, and most of it
 * is not an install: updates, in-app purchases and subscription renewals all
 * carry units too. `Product Type Identifier` is what separates them — the app
 * itself is the "1" family (1, 1F, 1T for iPhone, universal and iPad, 1E/1EP/1EU
 * for custom apps) plus F1 for Mac — so this counts those and nothing else,
 * rather than summing units and calling a version bump an install.
 *
 * Redownloads are dropped where Apple marks them, which is what makes this
 * "people who installed" rather than "devices that fetched a copy" — the same
 * distinction App Store Connect draws between App Units and Total Downloads.
 * Rows from older report versions have no Order Type at all and are counted.
 *
 * `rows` counts every line naming this app, whatever the product type, which is
 * a different question from how many installs there were: a day of nothing but
 * updates proves the vendor account ships the app while adding no installs. An
 * installs-only connection is validated on that, so an app can prove ownership
 * on a quiet day.
 */
export function parseInstalls(tsv: string, appStoreId: string): { installs: number; rows: number } {
  const empty = { installs: 0, rows: 0 }
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return empty

  const header = lines[0].split('\t').map((h) => h.trim())
  const index = (...candidates: string[]) => {
    for (const candidate of candidates) {
      const found = header.findIndex((h) => h.toLowerCase() === candidate.toLowerCase())
      if (found !== -1) return found
    }
    return -1
  }

  const appIdx = index('Apple Identifier', 'App Apple ID', 'App Apple Identifier')
  const unitsIdx = index('Units')
  const typeIdx = index('Product Type Identifier')
  const orderIdx = index('Order Type')

  /*
   * Fail closed, as the subscription parser does. A sales report we cannot
   * attribute to one app would otherwise credit this listing with every
   * download in the vendor account.
   */
  if (appIdx === -1 || unitsIdx === -1 || typeIdx === -1) {
    throw new ProviderError(
      'This sales report is missing the columns that identify a download, so we cannot ' +
        'count installs from it.',
    )
  }

  let installs = 0
  let rows = 0

  for (const line of lines.slice(1)) {
    const cells = line.split('\t')
    if (cells[appIdx]?.trim() !== appStoreId) continue
    rows++

    if (!isAppDownload(cells[typeIdx])) continue
    if (cells[orderIdx]?.trim().toLowerCase() === 'redownload') continue

    installs += toNumber(cells[unitsIdx])
  }

  return { installs, rows }
}

/** The product types that mean the app itself, not an update or a purchase. */
function isAppDownload(productType: string | undefined) {
  const value = (productType ?? '').trim().toUpperCase()
  return /^(1|1F|1T|1E|1EP|1EU|F1)$/.test(value)
}

/**
 * Apple's subscription report is a tab-separated file with a header row. Each
 * row is one subscription offer in one territory, with an active count and the
 * proceeds Apple pays out. We sum proceeds normalised to a monthly value.
 *
 * Rows are kept only for `appStoreId`. A vendor number covers every app in the
 * Apple account, so summing the file wholesale would credit one listing with a
 * whole portfolio's revenue — an honest founder with five apps would see all
 * five totals on whichever one they listed, and a dishonest one could point a
 * real account at someone else's app. `rows` reports how many lines matched,
 * which is what makes the difference between "no subscribers" and "not this
 * account's app" visible to the caller.
 */
export function parseSubscriptionReport(
  tsv: string,
  appStoreId: string,
): {
  mrrCents: number
  activeSubscriptions: number
  currency: string
  rows: number
} {
  const empty = { mrrCents: 0, activeSubscriptions: 0, currency: 'USD', rows: 0 }
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return empty

  const header = lines[0].split('\t').map((h) => h.trim())
  const columnIndex = (...candidates: string[]) => {
    for (const candidate of candidates) {
      const index = header.findIndex((h) => h.toLowerCase() === candidate.toLowerCase())
      if (index !== -1) return index
    }
    return -1
  }

  /*
   * Fail closed. A report we cannot attribute to one app is a report we cannot
   * publish a number from, and quietly falling back to the whole account is the
   * exact behaviour this filter exists to remove.
   */
  const appIdx = columnIndex('App Apple ID', 'App Apple Identifier', 'Apple Identifier')
  if (appIdx === -1) {
    throw new ProviderError(
      'This sales report has no App Apple ID column, so we cannot tell which app its ' +
        'figures belong to.',
    )
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
  let rows = 0

  for (const line of lines.slice(1)) {
    const cells = line.split('\t')

    if (cells[appIdx]?.trim() !== appStoreId) continue
    rows++

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

  return { mrrCents, activeSubscriptions, currency, rows }
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
  /*
   * Apple names the app on every row, so one vendor account can legitimately
   * back a listing per app it ships — which is the normal case for a founder
   * with a portfolio.
   */
  appScoped: true,

  async validate(credentials, target): Promise<ValidationResult> {
    const { parsed, reportDate, token } = await fetchLatestSubscriptionReport(
      credentials,
      target.appStoreId,
      true,
    )

    const installs = await fetchInstalls(token, credentials, target.appStoreId, reportDate)

    return {
      accountLabel: `Vendor ${credentials.vendorNumber}`,
      accountKey: credentials.vendorNumber,
      metrics: toMetrics(parsed, reportDate, installs),
    }
  },

  /*
   * Installs without the money, for an app whose revenue is already coming
   * from somewhere else. Both figures live in the same vendor account, so this
   * needs no extra credential — only a different report and the discipline to
   * report zero MRR, since the app's real MRR is another connection's to state
   * and the two are summed per day.
   */
  installs: {
    async validate(credentials, target): Promise<ValidationResult> {
      const { parsed, reportDate } = await fetchLatestSalesReport(
        credentials,
        target.appStoreId,
        true,
      )

      return {
        accountLabel: `Vendor ${credentials.vendorNumber} (installs)`,
        accountKey: credentials.vendorNumber,
        metrics: toInstallsMetrics(parsed.installs, reportDate),
      }
    },

    async fetchMetrics(credentials, target): Promise<NormalizedMetrics> {
      // No match required on the re-read, for the same reason the revenue path
      // drops it: a day nobody downloaded the app is not a broken connection.
      const { parsed, reportDate } = await fetchLatestSalesReport(
        credentials,
        target.appStoreId,
        false,
      )

      return toInstallsMetrics(parsed.installs, reportDate)
    },
  },

  async fetchMetrics(credentials, target): Promise<NormalizedMetrics> {
    /*
     * No match required on the daily re-read. Ownership was established when
     * the connection was made, and an app whose last subscriber lapsed reports
     * zero — failing here instead would spend the failure budget and disable a
     * connection for the offence of having no customers this week.
     */
    const { parsed, reportDate, token } = await fetchLatestSubscriptionReport(
      credentials,
      target.appStoreId,
      false,
    )

    const installs = await fetchInstalls(token, credentials, target.appStoreId, reportDate)

    return toMetrics(parsed, reportDate, installs)
  },
}

/**
 * Walks back to the newest sales report naming this app.
 *
 * The installs-only counterpart to `fetchLatestSubscriptionReport`, and the
 * ownership test works the same way: with `requireMatch` on, a report that
 * exists but names only other apps keeps the walk going, so finishing means
 * Apple itself attributed downloads of this App Store ID to this vendor
 * account.
 *
 * Reading the SALES report for this rather than the subscription one is what
 * lets a free app connect at all. `validate` on the revenue path insists on a
 * subscription row, which an app with downloads and no subscribers can never
 * produce — and installs are exactly the figure that app has to show.
 */
async function fetchLatestSalesReport(
  credentials: AppStoreConnectCredentials,
  appStoreId: string,
  requireMatch: boolean,
) {
  const token = await mintToken(credentials)

  for (let daysAgo = 1; daysAgo <= MAX_LOOKBACK_DAYS; daysAgo++) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - daysAgo)
    const reportDate = day.toISOString().slice(0, 10)

    const tsv = await fetchReport(token, {
      'filter[frequency]': 'DAILY',
      'filter[reportType]': 'SALES',
      'filter[reportSubType]': 'SUMMARY',
      'filter[vendorNumber]': credentials.vendorNumber,
      'filter[reportDate]': reportDate,
      'filter[version]': '1_1',
    })

    if (tsv === null) continue

    const parsed = parseInstalls(tsv, appStoreId)

    if (requireMatch && parsed.rows === 0) continue

    return { parsed, reportDate }
  }

  if (requireMatch) {
    throw new ProviderError(
      `This App Store Connect account published sales in the last ${MAX_LOOKBACK_DAYS} days, ` +
        'but none of them name this app. Check the vendor number belongs to the account that ' +
        'ships it.',
    )
  }

  throw new ProviderError(
    `No sales report published in the last ${MAX_LOOKBACK_DAYS} days. Apple publishes nothing ` +
      'for a day with no activity at all, so this can simply mean a very quiet week.',
  )
}

function toMetrics(
  parsed: ReturnType<typeof parseSubscriptionReport>,
  reportDate: string,
  installs: number | undefined,
): NormalizedMetrics {
  return {
    mrrCents: parsed.mrrCents,
    currency: parsed.currency,
    activeSubscriptions: parsed.activeSubscriptions,
    installs,
    capturedOn: new Date(`${reportDate}T00:00:00Z`),
  }
}

/**
 * An installs-only reading. `mrrCents` is zero rather than absent because the
 * column is not nullable — and zero is the truthful figure for this connection,
 * which is not being asked about the money and must not add to whatever the
 * revenue provider reports for the same day.
 */
function toInstallsMetrics(installs: number, reportDate: string): NormalizedMetrics {
  return {
    mrrCents: 0,
    currency: 'USD',
    installs,
    capturedOn: new Date(`${reportDate}T00:00:00Z`),
  }
}
