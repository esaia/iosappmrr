import { z } from 'zod'
import {
  ProviderError,
  todayUtc,
  type NormalizedMetrics,
  type ProviderAdapter,
  type ValidationResult,
} from './types'

const API_BASE = 'https://api-admin.adapty.io/api/v1/client-api'

/** Matches the window RevenueCat's overview reports over, so the two agree. */
const WINDOW_DAYS = 28

/**
 * Adapty allows 2 requests/second per key, and a reading takes four charts.
 * Sequential calls are already close to that ceiling on a fast connection, so
 * they are spaced rather than raced.
 */
const REQUEST_SPACING_MS = 500

export const adaptyCredentials = z.object({
  /** App-specific secret key from App settings → General → API keys. */
  secretKey: z
    .string()
    .trim()
    .regex(
      /^secret_(live|test)_[A-Za-z0-9._-]{8,}$/,
      'Adapty secret keys start with secret_live_. The public_live_ key is the one your app ' +
        'ships with, and it cannot read analytics.',
    ),
})

export type AdaptyCredentials = z.infer<typeof adaptyCredentials>

/**
 * One chart, as the analytics endpoint returns it.
 *
 * Every field is optional because Adapty fills a different subset per chart —
 * a running total like MRR carries `value_from`/`value_to`, a summed one like
 * revenue carries `value` — and the fields we do not read change without
 * notice. `chartValue` decides which of them is the answer.
 */
const chartData = z.object({
  value: z.number().nullish(),
  value_from: z.number().nullish(),
  value_to: z.number().nullish(),
  default_aggregation: z.string().nullish(),
  unit: z.string().nullish(),
})

export type ChartData = z.infer<typeof chartData>

const analyticsResponse = z.object({
  data: z.record(z.string(), chartData),
})

/**
 * Whether a chart's answer is where it ended up or what it added up to.
 *
 * MRR and an active-subscription count are levels: the figure that matters is
 * the one on the last day of the window. Revenue is a flow: the figure that
 * matters is the sum over the window. Reading the wrong one of the two turns a
 * $500 MRR into a $14,000 one, so each call says which it wants.
 */
export type Reading = 'level' | 'total'

/**
 * The number a chart is reporting, or a refusal.
 *
 * The refusal matters more than it looks. Adapty returns `value` on every
 * chart, so a missing `value_to` on a level chart could be papered over by
 * reading `value` instead — but on a chart Adapty sums, that is the 28-day
 * total wearing MRR's label, and it would be published as verified revenue.
 * The fallback is therefore allowed only where Adapty says it is not summing.
 */
export function chartValue(chart: ChartData, reading: Reading, chartId: string): number {
  if (reading === 'total') {
    if (typeof chart.value === 'number') return chart.value
    throw new ProviderError(`Adapty returned no ${chartId} total for this window.`, {
      retryable: true,
    })
  }

  if (typeof chart.value_to === 'number') return chart.value_to
  if (typeof chart.value === 'number' && chart.default_aggregation !== 'sum') return chart.value

  throw new ProviderError(
    `Adapty returned a ${chartId} figure we could not read without guessing what it means.`,
    { retryable: true },
  )
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchChart(credentials: AdaptyCredentials, chartId: string): Promise<ChartData> {
  const to = todayUtc()
  const from = new Date(to.getTime() - (WINDOW_DAYS - 1) * 86_400_000)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/metrics/analytics/`, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${credentials.secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        chart_id: chartId,
        filters: {
          date: [isoDay(from), isoDay(to)],
          /*
           * App Store money only. An Adapty app can bill on Google Play and
           * Stripe through the same project, and this index is about what an
           * App Store listing earns — an unfiltered figure would credit an
           * iOS app with its Android twin's revenue.
           */
          store: ['app_store'],
        },
        period_unit: 'day',
        format: 'json',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (cause) {
    throw new ProviderError('Could not reach Adapty.', { retryable: true, cause })
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      'Adapty rejected this key. Copy the secret key from App settings → General → API keys ' +
        'for the app you are listing — keys are per app, and the public SDK key will not work.',
    )
  }

  // 2 requests/second per key.
  if (response.status === 429) {
    throw new ProviderError('Adapty is rate limiting this key. Try again in a minute.', {
      retryable: true,
    })
  }

  if (!response.ok) {
    throw new ProviderError(`Adapty returned ${response.status}.`, { retryable: true })
  }

  const parsed = analyticsResponse.safeParse(await response.json())
  if (!parsed.success) {
    throw new ProviderError('Adapty returned a response we could not read.', {
      retryable: true,
      cause: parsed.error,
    })
  }

  /*
   * Adapty keys the response by metric rather than by the chart asked for — the
   * revenue chart comes back as `revenue`, `proceeds` and `net_revenue` — so
   * the requested id is preferred and the first entry is the fallback for the
   * charts that name their metric something else.
   */
  const chart = parsed.data.data[chartId] ?? Object.values(parsed.data.data)[0]
  if (!chart) {
    throw new ProviderError(`Adapty returned no ${chartId} chart.`, { retryable: true })
  }

  return chart
}

function nonNegative(value: number) {
  return Math.max(0, Math.round(value))
}

async function readMetrics(credentials: AdaptyCredentials): Promise<NormalizedMetrics> {
  const charts: ChartData[] = []
  for (const chartId of ['mrr', 'revenue', 'subscriptions_active', 'trials_active']) {
    if (charts.length) await delay(REQUEST_SPACING_MS)
    charts.push(await fetchChart(credentials, chartId))
  }

  const [mrr, revenue, subscriptions, trials] = charts

  return {
    // Adapty reports money in whole units, we store cents.
    mrrCents: Math.round(chartValue(mrr, 'level', 'MRR') * 100),
    currency: currencyOf(mrr),
    activeSubscriptions: nonNegative(chartValue(subscriptions, 'level', 'subscription')),
    activeTrials: nonNegative(chartValue(trials, 'level', 'trial')),
    revenue28dCents: Math.round(chartValue(revenue, 'total', 'revenue') * 100),
    /*
     * `newCustomers28d` is left unset deliberately. Adapty can report it, but
     * only as a fifth round trip against a 2-per-second limit, and it is a
     * line on the listing rather than the number the badge is about.
     */
    capturedOn: todayUtc(),
  }
}

/**
 * Adapty labels the unit on the chart itself. It converts everything to one
 * currency for the dashboard, so this is the account's reporting currency —
 * and USD is the assumption if it comes back as something that is not a
 * currency code at all.
 */
function currencyOf(chart: ChartData) {
  const unit = chart.unit?.toUpperCase() ?? ''
  return /^[A-Z]{3}$/.test(unit) ? unit : 'USD'
}

export const adaptyAdapter: ProviderAdapter<AdaptyCredentials> = {
  id: 'adapty',
  name: 'Adapty',
  docsUrl: 'https://adapty.io/docs/export-analytics-api-authorization',
  instructions:
    'Adapty issues one secret key per app, and it is not read-only — the same key can grant ' +
    'access levels and write profiles through their server API. We only ever call the ' +
    'analytics endpoint with it. If that is more trust than you want to hand over, connect ' +
    'App Store Connect instead: Apple’s key is scoped to finance reports alone.',
  steps: [
    { text: 'Open Adapty and go to App settings → General, in the app you are listing.' },
    {
      text: 'Find the API keys section and copy the secret key. It starts with secret_live_ — not the public SDK key, which cannot read analytics.',
    },
    {
      text: 'Paste it below. Keys are per app, so a key from another app in your Adapty account will report that app’s money.',
    },
  ],
  schema: adaptyCredentials,
  /*
   * The key names an Adapty app, and the store filter narrows it to App Store
   * money — but nothing Adapty exposes says *which* App Store app that is. So
   * unlike RevenueCat, where the project's bundle IDs are readable and checked,
   * a connection here proves only that the founder can read an App Store
   * revenue account. One account backs one listing, enforced on the way in.
   */
  appScoped: false,

  async validate(credentials): Promise<ValidationResult> {
    return {
      /*
       * The last four characters. Adapty publishes no account or app ID a
       * secret key can look up, so there is nothing steadier to show, and a
       * founder with two apps needs to tell the two keys apart.
       */
      accountLabel: `Adapty key …${credentials.secretKey.slice(-4)}`,
      /*
       * The key itself, for the same reason — see the Stripe adapter, which
       * makes the same trade. Rotating the key reads as a new account here.
       */
      accountKey: credentials.secretKey,
      metrics: await readMetrics(credentials),
    }
  },

  async fetchMetrics(credentials): Promise<NormalizedMetrics> {
    return readMetrics(credentials)
  },
}
