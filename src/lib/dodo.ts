import 'server-only'
import DodoPayments from 'dodopayments'

/**
 * Dodo Payments is the merchant of record for both paid products.
 *
 * It replaced Paddle, whose live account never finished Paddle's own account
 * review — checkout stayed dead with no ETA and no setting on our side to fix.
 * Dodo takes the same job on: it bills the customer, owns the tax, and pays
 * out, and its payout eligibility for this seller's country was confirmed
 * before switching (the same check that ruled out Polar before Paddle).
 *
 * Unlike Paddle, Dodo hosts its own checkout page. `createCheckout` returns
 * that URL directly and the caller redirects to it — no page of ours needs to
 * carry a client-side SDK or an inline frame.
 *
 * Everything here is optional at build time. With the environment unset the
 * site keeps its honest "checkout is not available" state rather than
 * rendering a buy button that would throw when clicked.
 */

export type PurchaseKind = 'dofollow' | 'sponsor'

const apiKey = process.env.DODO_PAYMENTS_API_KEY

/**
 * Dodo checks out a product directly — there is no separate price id to
 * confuse it with, unlike Paddle where the product and its price were
 * different ids and mixing them up silently broke checkout.
 */
const productIds: Record<PurchaseKind, string | undefined> = {
  dofollow: process.env.DODO_PRODUCT_DOFOLLOW,
  sponsor: process.env.DODO_PRODUCT_SPONSOR,
}

/**
 * Test mode is a separate Dodo deployment with its own keys, webhook secret
 * and product ids, so this is not a flag that can be flipped without also
 * swapping those.
 */
const environment = process.env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode'

/** True when a given product can actually be sold right now. */
export function isDodoConfigured(kind: PurchaseKind) {
  return Boolean(apiKey && productIds[kind])
}

export function productId(kind: PurchaseKind) {
  const id = productIds[kind]
  if (!id) {
    throw new Error(
      `No Dodo product is configured for "${kind}". Set DODO_PRODUCT_${kind.toUpperCase()}.`,
    )
  }
  return id
}

export function dodoClient() {
  if (!apiKey) {
    throw new Error('DODO_PAYMENTS_API_KEY is not set.')
  }
  return new DodoPayments({ bearerToken: apiKey, environment })
}

export function webhookSecret() {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  if (!secret) {
    throw new Error('DODO_PAYMENTS_WEBHOOK_KEY is not set.')
  }
  return secret
}

/**
 * Written onto every checkout session as `metadata`, and copied by Dodo onto
 * both the resulting payment and, for a subscription, the subscription
 * itself. The webhook reads it to decide what to grant.
 *
 * This is set server-side from the authenticated session and a verified
 * ownership check. It is never taken from a query parameter — a client that
 * could name the app id could buy a dofollow link for someone else's listing,
 * or for free by pointing a test-mode checkout at production.
 */
export type CheckoutMetadata = {
  kind: PurchaseKind
  appId: string
  profileId: string
}

export function parseMetadata(metadata: Record<string, unknown> | null | undefined) {
  const kind = metadata?.kind
  const appId = metadata?.appId
  const profileId = metadata?.profileId

  if (
    (kind !== 'dofollow' && kind !== 'sponsor') ||
    typeof appId !== 'string' ||
    typeof profileId !== 'string'
  ) {
    return null
  }

  return { kind, appId, profileId } satisfies CheckoutMetadata
}
