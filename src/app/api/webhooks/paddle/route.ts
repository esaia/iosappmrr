import { EventName, type EventEntity } from '@paddle/paddle-node-sdk'
import { activatePurchase, revokePurchase, setCancelAtPeriodEnd } from '@/lib/data/purchases'
import { minorUnitsToCents, paddleClient, parseMetadata, webhookSecret } from '@/lib/paddle'

/**
 * Paddle's webhook endpoint — the only place a purchase is granted.
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
  const signature = request.headers.get('paddle-signature')

  if (!signature) {
    // 403, not 400: an unsigned body is not a malformed request, it is an
    // unauthenticated one, and Paddle should not retry it.
    return new Response('Missing signature', { status: 403 })
  }

  /*
   * Configuration is checked apart from the signature, and answers 500 rather
   * than 403. The two failures look identical from here — an unset secret and a
   * forged body both end in "cannot verify this" — but they need opposite
   * handling: Paddle retries a 500 and gives up on a 403, so folding a missing
   * environment variable into the signature branch would quietly discard real
   * payments and log them as if someone had attacked the endpoint.
   */
  let paddle: ReturnType<typeof paddleClient>
  let secret: string
  try {
    paddle = paddleClient()
    secret = webhookSecret()
  } catch (error) {
    console.error('[paddle] webhook is not configured', error)
    return new Response('Webhook not configured', { status: 500 })
  }

  let event: EventEntity | null
  try {
    event = await paddle.webhooks.unmarshal(body, secret, signature)
  } catch (error) {
    console.error('[paddle] signature verification failed', error)
    return new Response('Invalid signature', { status: 403 })
  }

  if (!event) return new Response('Invalid signature', { status: 403 })

  try {
    await handle(event)
  } catch (error) {
    /*
     * 500 so Paddle retries. Every handler below is idempotent, so a retry
     * after a partial failure re-runs safely rather than double-granting.
     */
    console.error(`[paddle] handling ${event.eventType} failed`, error)
    return new Response('Handler failed', { status: 500 })
  }

  return new Response(null, { status: 202 })
}

async function handle(event: EventEntity) {
  switch (event.eventType) {
    /*
     * The grant event for both products. `transaction.paid` fires when the
     * money is taken but before Paddle has finished the books; `completed` is
     * the one that means the customer has what they bought.
     */
    case EventName.TransactionCompleted: {
      const transaction = event.data
      // Custom data is written by the server when the transaction is created.
      // A transaction without it did not come from our flow, so there is
      // nothing to grant.
      if (!parseMetadata(transaction.customData as Record<string, unknown>)) return

      await activatePurchase({
        checkoutId: transaction.id,
        orderId: transaction.id,
        subscriptionId: transaction.subscriptionId,
        amountCents: minorUnitsToCents(transaction.details?.totals?.total),
        currency: transaction.currencyCode,
      })
      return
    }

    /*
     * Renewals and reactivations. `transaction.completed` already covers the
     * first payment, but this carries the authoritative period end, which is
     * what the rails check before showing a sponsor.
     *
     * `updated` is included because that is how Paddle reports a scheduled
     * cancellation being set or cleared, and the period end moving on renewal.
     */
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionUpdated: {
      const subscription = event.data

      /*
       * The scheduled change is Paddle's "winding down" flag: the founder has
       * turned auto-renew off but keeps the slot until the period closes.
       * Anything else — a resume, a plan change — clears it.
       */
      const winding = subscription.scheduledChange?.action === 'cancel'
      const periodEnd = subscription.currentBillingPeriod?.endsAt
        ? new Date(subscription.currentBillingPeriod.endsAt)
        : undefined

      /*
       * Matched on the subscription alone. A subscription notification does not
       * name the transaction that created it, so the two are tied together by
       * `transaction.completed`, which does — until that arrives there is
       * nothing here to update, and it carries the grant anyway.
       */
      await activatePurchase({
        subscriptionId: subscription.id,
        currentPeriodEnd: periodEnd,
      })

      await setCancelAtPeriodEnd(subscription.id, winding, periodEnd)
      return
    }

    /*
     * The one that ends access. A cancellation scheduled for the period end
     * arrives as `subscription.updated` above and does not revoke anything —
     * this fires when the period has actually run out.
     */
    case EventName.SubscriptionCanceled: {
      await revokePurchase({ subscriptionId: event.data.id })
      return
    }

    /*
     * Refunds. Paddle models them as adjustments against a transaction rather
     * than as an event on the order, and an adjustment is only money back once
     * it is approved — a pending one may still be rejected.
     */
    case EventName.AdjustmentCreated:
    case EventName.AdjustmentUpdated: {
      const adjustment = event.data
      if (adjustment.action !== 'refund' || adjustment.status !== 'approved') return

      await revokePurchase({
        checkoutId: adjustment.transactionId,
        subscriptionId: adjustment.subscriptionId ?? undefined,
      })
      return
    }

    default:
      // Paddle sends far more than this endpoint subscribes to. Ignoring the
      // rest quietly is correct — a 4xx here would make Paddle retry forever.
      return
  }
}
