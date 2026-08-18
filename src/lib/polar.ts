import 'server-only'
import { Polar } from '@polar-sh/sdk'

/**
 * Polar is the merchant of record for both paid products.
 *
 * Stripe does not serve Georgia, which is why this is not a direct Stripe
 * integration. Note that Polar settles to sellers over Stripe Connect Express
 * and does not list Georgia among its supported seller countries either — the
 * checkout below works regardless, but payouts need an entity Polar supports.
 *
 * Everything here is optional at build time. With the environment unset the
 * site keeps its honest "checkout is not live yet" state rather than rendering
 * a buy button that would throw when clicked.
 */

export type PurchaseKind = 'dofollow' | 'sponsor'

const accessToken = process.env.POLAR_ACCESS_TOKEN
const productIds: Record<PurchaseKind, string | undefined> = {
  dofollow: process.env.POLAR_PRODUCT_DOFOLLOW,
  sponsor: process.env.POLAR_PRODUCT_SPONSOR,
}

/**
 * Sandbox is a separate Polar deployment with its own tokens and product ids,
 * so this is not a flag that can be flipped without also swapping those.
 */
const server = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'

/** True when a given product can actually be sold right now. */
export function isPolarConfigured(kind: PurchaseKind) {
  return Boolean(accessToken && productIds[kind])
}

export function productId(kind: PurchaseKind) {
  const id = productIds[kind]
  if (!id) {
    throw new Error(
      `No Polar product is configured for "${kind}". Set POLAR_PRODUCT_${kind.toUpperCase()}.`,
    )
  }
  return id
}

export function polarClient() {
  if (!accessToken) {
    throw new Error('POLAR_ACCESS_TOKEN is not set.')
  }
  return new Polar({ accessToken, server })
}

export function webhookSecret() {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('POLAR_WEBHOOK_SECRET is not set.')
  }
  return secret
}

/**
 * Metadata written onto every checkout, and copied by Polar onto the resulting
 * order and subscription. The webhook reads it to decide what to grant.
 *
 * This is set server-side from the authenticated session and a verified
 * ownership check. It is never taken from a query parameter — a client that
 * could name the app id could buy a dofollow link for someone else's listing,
 * or for free by pointing a sandbox checkout at production.
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
