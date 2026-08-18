import { z } from 'zod'
import {
  ProviderError,
  todayUtc,
  type NormalizedMetrics,
  type ProviderAdapter,
  type ValidationResult,
} from './types'

const API_BASE = 'https://api.revenuecat.com/v2'

export const revenueCatCredentials = z.object({
  /** v2 secret key, scoped to `charts_metrics:overview:read`. */
  apiKey: z.string().trim().min(20, 'That does not look like a RevenueCat v2 secret key.'),
  projectId: z.string().trim().min(4, 'Project ID is required.'),
})

export type RevenueCatCredentials = z.infer<typeof revenueCatCredentials>

/**
 * The overview endpoint returns the same figures as the RevenueCat dashboard,
 * as a list of `{ id, value, unit }` objects. We read the ones we need by id
 * and ignore the rest, so RevenueCat adding metrics never breaks the sync.
 */
const overviewResponse = z.object({
  object: z.string().optional(),
  currency: z.string().nullish(),
  metrics: z.array(
    z.object({
      id: z.string(),
      value: z.number().nullable(),
      unit: z.string().nullish(),
      period: z.string().nullish(),
      last_updated_at: z.number().nullish(),
    }),
  ),
})

export type Overview = z.infer<typeof overviewResponse>

function metricValue(overview: Overview, id: string) {
  return overview.metrics.find((m) => m.id === id)?.value ?? null
}

async function fetchOverview(credentials: RevenueCatCredentials) {
  const url = `${API_BASE}/projects/${encodeURIComponent(credentials.projectId)}/metrics/overview`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (cause) {
    throw new ProviderError('Could not reach RevenueCat.', { retryable: true, cause })
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      'RevenueCat rejected this key. Check that it is a v2 secret key with the ' +
        '"charts_metrics:overview:read" permission, and that it belongs to this project.',
    )
  }

  if (response.status === 404) {
    throw new ProviderError('No RevenueCat project with that ID. Check the project ID.')
  }

  // 25 requests/minute per key. The sync job paces itself, but a founder
  // hammering the connect button can still hit it.
  if (response.status === 429) {
    throw new ProviderError('RevenueCat is rate limiting this key. Try again in a minute.', {
      retryable: true,
    })
  }

  if (!response.ok) {
    throw new ProviderError(`RevenueCat returned ${response.status}.`, { retryable: true })
  }

  const parsed = overviewResponse.safeParse(await response.json())
  if (!parsed.success) {
    throw new ProviderError('RevenueCat returned a response we could not read.', {
      retryable: true,
      cause: parsed.error,
    })
  }

  return parsed.data
}

export function normalizeOverview(overview: Overview): NormalizedMetrics {
  const mrr = metricValue(overview, 'mrr')
  if (mrr === null) {
    throw new ProviderError(
      'RevenueCat did not return an MRR figure for this project. The key is probably ' +
        'missing the "charts_metrics:overview:read" permission.',
    )
  }

  const revenue28d = metricValue(overview, 'revenue')

  return {
    // RevenueCat reports money in whole units (dollars), we store cents.
    mrrCents: Math.round(mrr * 100),
    currency: (overview.currency ?? 'USD').toUpperCase(),
    activeSubscriptions: nonNegative(metricValue(overview, 'active_subscriptions')),
    activeTrials: nonNegative(metricValue(overview, 'active_trials')),
    newCustomers28d: nonNegative(metricValue(overview, 'new_customers')),
    revenue28dCents: revenue28d === null ? undefined : Math.round(revenue28d * 100),
    capturedOn: todayUtc(),
  }
}

function nonNegative(value: number | null) {
  return value === null ? undefined : Math.max(0, Math.round(value))
}

export const revenueCatAdapter: ProviderAdapter<RevenueCatCredentials> = {
  id: 'revenuecat',
  name: 'RevenueCat',
  docsUrl: 'https://www.revenuecat.com/docs/api-v2',
  instructions:
    'In RevenueCat, open Project settings → API keys and create a new V2 secret key. ' +
    'Give it one permission: charts_metrics:overview:read. That key can read your ' +
    'revenue charts and nothing else — it cannot see customers, issue refunds, or change ' +
    'anything in your project.',
  schema: revenueCatCredentials,

  async validate(credentials): Promise<ValidationResult> {
    return {
      accountLabel: `Project ${credentials.projectId}`,
      metrics: normalizeOverview(await fetchOverview(credentials)),
    }
  },

  async fetchMetrics(credentials) {
    return normalizeOverview(await fetchOverview(credentials))
  },
}
