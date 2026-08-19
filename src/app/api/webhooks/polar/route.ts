import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks.js'
import { activatePurchase, revokePurchase, setCancelAtPeriodEnd } from '@/lib/data/purchases'
import { parseMetadata, webhookSecret } from '@/lib/polar'

/**
 * Polar's webhook endpoint — the only place a purchase is granted.
 *
 * The success URL the customer lands on proves nothing: anyone can type it.
 * A signed webhook is the only evidence money actually moved, so every write
 * that hands out something paid for happens here.
 *
 * Node runtime, not edge: signature verification needs the raw bytes and the
 * database client is a Postgres socket.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.text()
  const headers = Object.fromEntries(request.headers.entries())

  let event: ReturnType<typeof validateEvent>
  try {
    event = validateEvent(body, headers, webhookSecret())
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // 403, not 400: an unsigned body is not a malformed request, it is an
      // unauthenticated one, and Polar should not retry it.
      return new Response('Invalid signature', { status: 403 })
    }
    throw error
  }

  try {
    await handle(event)
  } catch (error) {
    /*
     * 500 so Polar retries. Every handler below is idempotent, so a retry
     * after a partial failure re-runs safely rather than double-granting.
     */
    console.error(`[polar] handling ${event.type} failed`, error)
    return new Response('Handler failed', { status: 500 })
  }

  return new Response(null, { status: 202 })
}

async function handle(event: ReturnType<typeof validateEvent>) {
  switch (event.type) {
    /*
     * The grant event for both products. `order.created` fires before payment
     * settles, so granting there would hand out a dofollow link for a card
     * that has not cleared.
     */
    case 'order.paid': {
      const order = event.data
      if (!order.checkoutId) return
      // Metadata is copied from the checkout, which the server wrote. An order
      // without it did not come from our flow, so there is nothing to grant.
      if (!parseMetadata(order.metadata)) return

      await activatePurchase({
        polarCheckoutId: order.checkoutId,
        polarOrderId: order.id,
        polarSubscriptionId: order.subscriptionId,
        amountCents: order.totalAmount,
        currency: order.currency,
      })
      return
    }

    /*
     * Renewals and reactivations. `order.paid` already covers the first
     * payment, but this carries the authoritative period end, which is what
     * the rails check before showing a sponsor.
     */
    case 'subscription.active':
    case 'subscription.uncanceled': {
      const subscription = event.data
      if (!subscription.checkoutId) return

      await activatePurchase({
        polarCheckoutId: subscription.checkoutId,
        polarSubscriptionId: subscription.id,
        amountCents: subscription.amount,
        currency: subscription.currency,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })
      return
    }

    /*
     * Auto-renew turned off. Deliberately not a revoke: the sponsor has paid
     * through the end of the period and keeps the slot until then, so only the
     * winding-down flag moves. Handled even though the founder can do this on
     * the account screen, because they can also do it in Polar's own portal,
     * and then this is the only way we hear about it.
     */
    case 'subscription.canceled': {
      const subscription = event.data
      await setCancelAtPeriodEnd(subscription.id, true, subscription.currentPeriodEnd)
      return
    }

    /*
     * `revoked` is the one that ends access, not `canceled` above.
     */
    case 'subscription.revoked': {
      await revokePurchase({ polarSubscriptionId: event.data.id })
      return
    }

    case 'order.refunded': {
      const order = event.data
      await revokePurchase({
        polarCheckoutId: order.checkoutId,
        polarSubscriptionId: order.subscriptionId,
      })
      return
    }

    default:
      // Polar sends far more than this endpoint subscribes to. Ignoring the
      // rest quietly is correct — a 4xx here would make Polar retry forever.
      return
  }
}
