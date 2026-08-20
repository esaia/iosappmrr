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
  /** Money taken on `capturedOn` alone. Only providers with a per-day report
   * can fill this; RevenueCat's overview cannot. */
  revenueCents?: number
  /**
   * The day this measurement describes. Providers with reporting lag (App Store
   * Connect) report an older date than today, and the UI surfaces it.
   */
  capturedOn: Date
}

/**
 * The listing a credential is being checked against.
 *
 * Passed to every provider call, because "this key reads a revenue account" and
 * "this key reads *this app's* revenue account" are different claims, and only
 * the second one is worth a verified badge. A provider that can tell the
 * difference is expected to prove the link and to report figures for this app
 * alone; see `appScoped`.
 */
export type VerificationTarget = {
  /** Numeric Apple ID from the App Store URL, e.g. "6448311069". */
  appStoreId: string
  /** From the iTunes lookup. Null when Apple did not publish one. */
  bundleId: string | null
  name: string
}

export type ValidationResult = {
  /** Non-secret hint shown in the dashboard, e.g. "Project proj1a2b". */
  accountLabel: string
  /**
   * Stable, non-secret identity of the account behind the credential — the
   * RevenueCat project, the Apple vendor number. Two connections that resolve
   * to the same account are reading the same books, which is what
   * `connectProvider` uses to stop one account backing several listings.
   *
   * Not the credential itself: rotating a key must not read as a new account,
   * and two keys on one project must collide.
   */
  accountKey: string
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
  /**
   * Whether the figures this provider returns describe the target app alone.
   *
   * True only where the provider names the app in its own data and the adapter
   * filters on it — App Store Connect, whose report has an App Apple ID column.
   * False where the numbers cover a whole account that may hold several apps,
   * which is every other provider here: RevenueCat's overview is per project,
   * Stripe's subscriptions are per account. An account-wide provider may back
   * exactly one listing, or two founders' pages would show the same money.
   */
  appScoped: boolean
  /** Live test call. Throws ProviderError on failure; never persists anything. */
  validate(credentials: TCredentials, target: VerificationTarget): Promise<ValidationResult>
  fetchMetrics(credentials: TCredentials, target: VerificationTarget): Promise<NormalizedMetrics>
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
