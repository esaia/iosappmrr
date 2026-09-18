import 'server-only'
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks'
import { activatePurchase, revokePurchase, setCancelAtPeriodEnd } from '@/lib/data/purchases'
import { dodoClient, parseMetadata } from '@/lib/dodo'

/**
 * Verifies and applies one Dodo webhook delivery, given the secret to check it
 * against.
 *
 * Shared by two routes rather than one: this deployment is always in live
 * mode, so a webhook signed with the test-mode secret can never verify against
 * `DODO_PAYMENTS_WEBHOOK_KEY`. `/api/webhooks/dodo-test` exists to hold a
 * second secret for exactly that traffic — same handler, same database, so a
 * test-mode purchase made anywhere (including localhost, which shares this
 * database) still gets granted without a tunnel back to a laptop.
 *
 * None of the handling below calls back into the Dodo API, so which
 * environment's client did the verifying makes no difference to it.
 */
export async function handleDodoWebhook(request: Request, secret: string): Promise<Response> {
  const body = await request.text()

  const webhookId = request.headers.get('webhook-id')
  const webhookSignature = request.headers.get('webhook-signature')
  const webhookTimestamp = request.headers.get('webhook-timestamp')

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    // 403, not 400: an unsigned body is not a malformed request, it is an
    // unauthenticated one, and Dodo should not retry it.
    return new Response('Missing signature', { status: 403 })
  }

  let dodo: ReturnType<typeof dodoClient>
  try {
    dodo = dodoClient()
  } catch (error) {
    console.error('[dodo] webhook is not configured', error)
    return new Response('Webhook not configured', { status: 500 })
  }

  let event: UnwrapWebhookEvent
  try {
    event = dodo.webhooks.unwrap(body, {
      headers: {
        'webhook-id': webhookId,
        'webhook-signature': webhookSignature,
        'webhook-timestamp': webhookTimestamp,
      },
      key: secret,
    })
  } catch (error) {
    console.error('[dodo] signature verification failed', error)
    return new Response('Invalid signature', { status: 403 })
  }

  try {
    await handle(event)
  } catch (error) {
    /*
     * 500 so Dodo retries. Every handler below is idempotent, so a retry
     * after a partial failure re-runs safely rather than double-granting.
     */
    console.error(`[dodo] handling ${event.type} failed`, error)
    return new Response('Handler failed', { status: 500 })
  }

  return new Response(null, { status: 202 })
}

async function handle(event: UnwrapWebhookEvent) {
  switch (event.type) {
    /*
     * The grant event for both products. Metadata is written by the server
     * when the checkout session is created, and Dodo copies it onto the
     * payment it produces.
     */
    case 'payment.succeeded': {
      const payment = event.data
      if (!parseMetadata(payment.metadata)) return

      await activatePurchase({
        checkoutId: payment.checkout_session_id,
        orderId: payment.payment_id,
        subscriptionId: payment.subscription_id,
        amountCents: payment.total_amount,
        currency: payment.currency,
      })
      return
    }

    /*
     * Renewals and reactivations. `payment.succeeded` already covers the
     * first payment, but this carries the authoritative period end, which is
     * what the rails check before showing a sponsor.
     */
    case 'subscription.active':
    case 'subscription.renewed': {
      const subscription = event.data

      await activatePurchase({
        subscriptionId: subscription.subscription_id,
        currentPeriodEnd: new Date(subscription.next_billing_date),
      })

      await setCancelAtPeriodEnd(
        subscription.subscription_id,
        subscription.cancel_at_next_billing_date,
        new Date(subscription.next_billing_date),
      )
      return
    }

    /*
     * The one that ends access. A cancellation scheduled for the period end
     * sets `cancel_at_next_billing_date` above and does not revoke anything —
     * this fires when the period has actually run out.
     */
    case 'subscription.cancelled': {
      await revokePurchase({ subscriptionId: event.data.subscription_id })
      return
    }

    /*
     * Refunds. A refund only carries the id of the payment it refunds, not
     * the checkout session that opened it, which is why `revokePurchase`
     * also matches by `orderId`.
     */
    case 'refund.succeeded': {
      await revokePurchase({ orderId: event.data.payment_id })
      return
    }

    default:
      // Dodo sends far more than this endpoint subscribes to. Ignoring the
      // rest quietly is correct — a 4xx here would make Dodo retry forever.
      return
  }
}
