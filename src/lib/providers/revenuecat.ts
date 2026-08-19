import { z } from 'zod'
import { site } from '@/lib/site'
import {
  ProviderError,
  todayUtc,
  type NormalizedMetrics,
  type ProviderAdapter,
  type ValidationResult,
  type VerificationTarget,
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

/**
 * The apps configured in a RevenueCat project. Read with the same key, under
 * the `project_configuration:apps` permission the setup steps already ask for.
 */
const appsResponse = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
})

/**
 * Every bundle ID anywhere in an app object, found by walking it.
 *
 * RevenueCat nests the identifier under a platform-specific key — `app_store`
 * for an App Store app — and has more platforms than this file should have to
 * enumerate. Collecting every `bundle_id` it can see costs nothing and does not
 * break the day a key is renamed or a platform is added, whereas reading one
 * hard-coded path would silently start failing every honest founder.
 */
function bundleIds(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) bundleIds(item, found)
    return found
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'bundle_id' && typeof nested === 'string' && nested.trim()) {
        found.push(nested.trim())
      } else {
        bundleIds(nested, found)
      }
    }
  }
  return found
}

async function fetchProjectApps(credentials: RevenueCatCredentials) {
  const url = `${API_BASE}/projects/${encodeURIComponent(credentials.projectId)}/apps?limit=100`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (cause) {
    throw new ProviderError('Could not reach RevenueCat.', { retryable: true, cause })
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      'This key cannot list the apps in the project, so we cannot check that it is the ' +
        'project behind this listing. Add the "project_configuration:apps" read permission ' +
        'to the key and try again.',
    )
  }

  if (!response.ok) {
    throw new ProviderError(`RevenueCat returned ${response.status} listing project apps.`, {
      retryable: true,
    })
  }

  const parsed = appsResponse.safeParse(await response.json())
  if (!parsed.success) {
    throw new ProviderError('RevenueCat returned an app list we could not read.', {
      retryable: true,
      cause: parsed.error,
    })
  }

  return parsed.data.items
}

/**
 * Refuses a key whose project does not contain the app being listed.
 *
 * Without this, the only thing a connection proves is that the founder can read
 * *some* revenue account — so anyone could list Facebook, attach their own
 * project, and publish their own MRR under Facebook's name. Matching the bundle
 * ID ties the money to the listing.
 *
 * It raises the cost of a false claim rather than closing it: RevenueCat does
 * not itself verify that you own a bundle ID when you add an App Store app, so
 * a determined liar can type someone else's into their own project. Proof of
 * ownership has to come from Apple, which is what the App Store Connect adapter
 * checks and what a domain challenge would add here.
 */
export async function assertProjectOwnsApp(
  credentials: RevenueCatCredentials,
  target: VerificationTarget,
) {
  if (!target.bundleId) {
    throw new ProviderError(
      'The App Store did not publish a bundle ID for this app, so we cannot check that this ' +
        'RevenueCat project is the one behind it. Connect App Store Connect instead.',
    )
  }

  const items = await fetchProjectApps(credentials)
  const wanted = target.bundleId.toLowerCase()
  const found = items.flatMap((item) => bundleIds(item)).map((id) => id.toLowerCase())

  if (found.includes(wanted)) return

  throw new ProviderError(
    found.length
      ? `This RevenueCat project has no app with the bundle ID ${target.bundleId}. It holds ` +
          `${found.slice(0, 3).join(', ')}${found.length > 3 ? ', …' : ''}. Connect the project ` +
          'that ships this app, or list the app that project ships.'
      : `This RevenueCat project has no App Store app configured, so we cannot tie it to ` +
          `${target.name}. Add the app to the project in RevenueCat, then try again.`,
  )
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
    'A V2 secret key, read-only. It can see your revenue charts and nothing else — ' +
    'it cannot read customers, issue refunds, or change anything in your project.',
  steps: [
    { text: 'Open RevenueCat and go to Project settings → API keys.' },
    {
      text: `Click + New secret API key. Name it whatever you like — ${site.shortName} keeps it obvious later — and set the version to V2.`,
    },
    {
      text: 'Turn on Read for these permissions, and leave everything else off:',
      permissions: [
        'project_configuration:projects',
        'project_configuration:apps',
        'charts_metrics:charts',
        'charts_metrics:overview',
      ],
    },
    { text: 'Click Generate, then paste the key below. It starts with sk_.' },
    {
      text: 'The project ID is on that same settings page, and starts with proj. It goes in the field above the key.',
    },
  ],
  schema: revenueCatCredentials,
  /*
   * The overview endpoint reports the whole project, and a project can hold
   * several apps. So the figure is right only when the project is one app's —
   * hence one listing per project, enforced on the way in.
   */
  appScoped: false,

  async validate(credentials, target): Promise<ValidationResult> {
    // Ownership first: a founder who has attached the wrong project should hear
    // that, not a number that looks convincing.
    await assertProjectOwnsApp(credentials, target)

    return {
      accountLabel: `Project ${credentials.projectId}`,
      accountKey: credentials.projectId,
      metrics: normalizeOverview(await fetchOverview(credentials)),
    }
  },

  async fetchMetrics(credentials) {
    return normalizeOverview(await fetchOverview(credentials))
  },
}
