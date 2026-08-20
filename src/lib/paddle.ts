import 'server-only'
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

/**
 * Paddle is the merchant of record for both paid products.
 *
 * It replaced Polar, which settles to sellers over Stripe Connect Express and
 * does not support Georgia — the checkout worked, the payout did not. Paddle
 * takes the same job on: it bills the customer, owns the VAT, and pays out.
 *
 * The one structural difference is worth knowing before reading `checkout.ts`.
 * Polar hosted the checkout page; Paddle does not. A Paddle checkout opens on a
 * page we host that loads Paddle.js — `/checkout/pay` — and the transaction is
 * carried to it in the `_ptxn` query parameter. So `createCheckout` still
 * returns a URL, and every caller is unchanged, but the URL is one of ours.
 *
 * Everything here is optional at build time. With the environment unset the
 * site keeps its honest "checkout is not live yet" state rather than rendering
 * a buy button that would throw when clicked.
 */

export type PurchaseKind = 'dofollow' | 'sponsor'

const apiKey = process.env.PADDLE_API_KEY

/**
 * Price ids, not product ids: Paddle checks out a price, and one product can
 * hold several — the monthly sponsor slot and an annual one would share a
 * product but never a price.
 */
const priceIds: Record<PurchaseKind, string | undefined> = {
  dofollow: process.env.PADDLE_PRICE_DOFOLLOW,
  sponsor: process.env.PADDLE_PRICE_SPONSOR,
}

/**
 * Sandbox is a separate Paddle deployment with its own keys, tokens and price
 * ids, so this is not a flag that can be flipped without also swapping those.
 */
const environment =
  process.env.PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox

/** True when a given product can actually be sold right now. */
export function isPaddleConfigured(kind: PurchaseKind) {
  return Boolean(apiKey && priceIds[kind])
}

export function priceId(kind: PurchaseKind) {
  const id = priceIds[kind]
  if (!id) {
    throw new Error(
      `No Paddle price is configured for "${kind}". Set PADDLE_PRICE_${kind.toUpperCase()}.`,
    )
  }
  return id
}

export function paddleClient() {
  if (!apiKey) {
    throw new Error('PADDLE_API_KEY is not set.')
  }
  return new Paddle(apiKey, { environment })
}

export function webhookSecret() {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('PADDLE_WEBHOOK_SECRET is not set.')
  }
  return secret
}

/**
 * Written onto every transaction as `custom_data`, and copied by Paddle onto
 * the subscription a recurring transaction creates. The webhook reads it to
 * decide what to grant.
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

/**
 * Paddle reports money as a string of minor units — "1900" is $19.00 — because
 * a JSON number would lose precision on currencies that need it. We store
 * integer cents, so the conversion is a parse, not a division.
 */
export function minorUnitsToCents(amount: string | null | undefined) {
  if (!amount) return null
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}
