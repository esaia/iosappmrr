import Stripe from 'stripe'
import { z } from 'zod'
import {
  ProviderError,
  todayUtc,
  type NormalizedMetrics,
  type ProviderAdapter,
  type ValidationResult,
} from './types'

export const stripeCredentials = z.object({
  /** Restricted key (rk_live_…) with read access to subscriptions. */
  secretKey: z
    .string()
    .trim()
    .regex(/^(rk|sk)_(live|test)_[A-Za-z0-9]+$/, 'That does not look like a Stripe API key.'),
})

export type StripeCredentials = z.infer<typeof stripeCredentials>

/** Guard against unbounded pagination on very large accounts. */
const MAX_PAGES = 40
const PAGE_SIZE = 100

/** Converts a Stripe recurring price to its monthly-equivalent amount in cents. */
export function monthlyAmountCents(
  unitAmount: number,
  quantity: number,
  interval: string,
  intervalCount: number,
) {
  const perMonth: Record<string, number> = {
    day: 365 / 12,
    week: 52 / 12,
    month: 1,
    year: 1 / 12,
  }

  // Stripe types `interval` as an open string union. An unrecognised term is
  // treated as monthly rather than silently contributing nothing.
  const factor = perMonth[interval] ?? 1

  return Math.round((unitAmount * quantity * factor) / Math.max(1, intervalCount))
}

async function collectMrr(credentials: StripeCredentials) {
  const stripe = new Stripe(credentials.secretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  })

  let mrrCents = 0
  let activeSubscriptions = 0
  let activeTrials = 0
  let currency = 'usd'
  let startingAfter: string | undefined
  let pages = 0

  try {
    do {
      const page = await stripe.subscriptions.list({
        status: 'all',
        limit: PAGE_SIZE,
        starting_after: startingAfter,
        expand: ['data.items.data.price'],
      })

      for (const subscription of page.data) {
        if (subscription.status === 'trialing') {
          activeTrials++
          continue
        }
        if (subscription.status !== 'active') continue

        activeSubscriptions++

        for (const item of subscription.items.data) {
          const price = item.price
          if (!price.recurring || price.unit_amount === null) continue

          currency = price.currency
          mrrCents += monthlyAmountCents(
            price.unit_amount,
            item.quantity ?? 1,
            price.recurring.interval,
            price.recurring.interval_count || 1,
          )
        }
      }

      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined
      pages++
    } while (startingAfter && pages < MAX_PAGES)
  } catch (error) {
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      throw new ProviderError(
        'Stripe rejected this key. Use a restricted key with read access to Subscriptions.',
        { cause: error },
      )
    }
    if (error instanceof Stripe.errors.StripePermissionError) {
      throw new ProviderError(
        'This restricted key cannot read subscriptions. Grant it the Subscriptions read ' +
          'permission in Stripe.',
        { cause: error },
      )
    }
    if (error instanceof Stripe.errors.StripeRateLimitError) {
      throw new ProviderError('Stripe is rate limiting this key.', {
        retryable: true,
        cause: error,
      })
    }
    throw new ProviderError('Could not read subscriptions from Stripe.', {
      retryable: true,
      cause: error,
    })
  }

  return { mrrCents, activeSubscriptions, activeTrials, currency: currency.toUpperCase() }
}

export const stripeAdapter: ProviderAdapter<StripeCredentials> = {
  id: 'stripe',
  name: 'Stripe',
  docsUrl: 'https://docs.stripe.com/keys#limit-access',
  instructions:
    'Only needed if your app bills outside the App Store — a web checkout or companion ' +
    'subscription. In Stripe, go to Developers → API keys → Create restricted key and grant ' +
    'read access to Subscriptions and nothing else. Revenue from Stripe is added to your ' +
    'in-app revenue, not counted twice.',
  schema: stripeCredentials,
  /*
   * Stripe knows nothing about App Store listings: a subscription there names a
   * price and a customer, never an app. So the figure covers the whole Stripe
   * account and cannot be tied to the app being verified — which is why one
   * account may back only one listing, and why Stripe stays off the connect
   * screen as a source on its own.
   */
  appScoped: false,

  async validate(credentials): Promise<ValidationResult> {
    const result = await collectMrr(credentials)
    return {
      accountLabel: `Stripe ${credentials.secretKey.slice(0, 7)}…`,
      /*
       * The key itself, since Stripe offers nothing steadier that a restricted
       * subscriptions-read key is allowed to see — `/v1/account` needs a
       * permission we deliberately do not ask for. Rotating the key therefore
       * reads as a new account here; the cost of that is one stale row, against
       * asking every founder for a broader key than the job needs.
       */
      accountKey: credentials.secretKey,
      metrics: toMetrics(result),
    }
  },

  async fetchMetrics(credentials): Promise<NormalizedMetrics> {
    return toMetrics(await collectMrr(credentials))
  },
}

function toMetrics(result: Awaited<ReturnType<typeof collectMrr>>): NormalizedMetrics {
  return {
    mrrCents: result.mrrCents,
    currency: result.currency,
    activeSubscriptions: result.activeSubscriptions,
    activeTrials: result.activeTrials,
    capturedOn: todayUtc(),
  }
}
