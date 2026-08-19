import { z } from 'zod'

export const PROVIDER_IDS = ['revenuecat', 'app_store_connect', 'superwall', 'stripe'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

/**
 * What every provider is normalised to. Money is always integer cents; a
 * provider that reports annual plans must divide down to a monthly figure
 * before returning, so MRR means the same thing across the whole site.
 */
export type NormalizedMetrics = {
  mrrCents: number
  currency: string
  activeSubscriptions?: number
  activeTrials?: number
  newCustomers28d?: number
  revenue28dCents?: number
  /**
   * The day this measurement describes. Providers with reporting lag (App Store
   * Connect) report an older date than today, and the UI surfaces it.
   */
  capturedOn: Date
}

export type ValidationResult = {
  /** Non-secret hint shown in the dashboard, e.g. "Project proj1a2b". */
  accountLabel: string
  metrics: NormalizedMetrics
}

/**
 * One numbered step in a provider's setup, with the permissions to tick if that
 * is what the step is about.
 *
 * The permissions ride along with their step rather than sitting in a list of
 * their own: a founder reads "turn on Read for these", and the boxes to find
 * are the next thing on the screen.
 */
export type ProviderStep = {
  text: string
  permissions?: readonly string[]
}

export type ProviderAdapter<TCredentials> = {
  id: ProviderId
  name: string
  /** Rendered on the connect screen, above the credential fields. */
  instructions: string
  /**
   * The click-by-click, for a key that takes more than a sentence to make.
   * Optional: a provider whose summary covers it should not pad this out.
   */
  steps?: readonly ProviderStep[]
  /** Where the founder gets the credential. */
  docsUrl: string
  schema: z.ZodType<TCredentials>
  /** Live test call. Throws ProviderError on failure; never persists anything. */
  validate(credentials: TCredentials): Promise<ValidationResult>
  fetchMetrics(credentials: TCredentials): Promise<NormalizedMetrics>
}

/**
 * A failure the founder can act on. `retryable` failures (rate limits, provider
 * outages) do not count toward the consecutive-failure budget that disables a
 * connection.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ProviderError'
  }

  get retryable() {
    return this.options.retryable ?? false
  }
}

export function todayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
