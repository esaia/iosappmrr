import './load-env'
import { and, eq, isNotNull } from 'drizzle-orm'
import DodoPayments from 'dodopayments'
import { db } from '../src/db'
import { purchases } from '../src/db/schema'
import { activatePurchase } from '../src/lib/data/purchases'

/**
 * Settles purchases whose webhook never arrived.
 *
 * A webhook is a delivery, not a guarantee: the endpoint can be missing,
 * misconfigured, or down when a payment succeeds, and Dodo only retries
 * deliveries for a limited window. Without a way to ask Dodo after the fact,
 * a payment taken during any such window is stranded — money charged, nothing
 * granted, and no path to recovery.
 *
 * So this asks Dodo the same question the webhook would have answered: for
 * every purchase still `pending`, has its checkout session produced a
 * completed payment? It calls the same `activatePurchase` the webhook does
 * rather than reimplementing the grant, so the two cannot drift apart, and
 * that function is idempotent — running this repeatedly, or alongside a
 * webhook that later arrives, is safe.
 *
 *   npm run dodo:reconcile          # report only
 *   npm run dodo:reconcile -- --fix # apply
 */

async function main() {
  const apply = process.argv.includes('--fix')
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  if (!apiKey) {
    console.error('DODO_PAYMENTS_API_KEY is not set.')
    process.exit(1)
  }

  const env = process.env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode'
  const dodo = new DodoPayments({ bearerToken: apiKey, environment: env })

  /*
   * Admin grants are excluded by the checkout-id filter rather than by source:
   * they never had a checkout session, so there is nothing at Dodo to
   * reconcile them against, and asking would only produce a confusing
   * "not found" line.
   */
  const pending = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.status, 'pending'), isNotNull(purchases.checkoutId)))

  if (pending.length === 0) {
    console.log('\nNo pending purchases. Nothing to reconcile.\n')
    return
  }

  console.log(`\nReconciling ${pending.length} pending purchase(s) against Dodo (${env})\n`)

  let settled = 0

  for (const purchase of pending) {
    // Narrowed by the `isNotNull` filter above; TypeScript cannot see that.
    const sessionId = purchase.checkoutId!
    const label = `${purchase.kind} / session ${sessionId.slice(0, 12)}…`

    let session
    try {
      session = await dodo.checkoutSessions.retrieve(sessionId)
    } catch {
      console.log(`  ${label}\n    no such checkout session at Dodo, leaving pending\n`)
      continue
    }

    if (!session.payment_id || session.payment_status !== 'succeeded') {
      console.log(
        `  ${label}\n    status ${session.payment_status ?? 'no payment yet'} — not settled, leaving pending\n`,
      )
      continue
    }

    const payment = await dodo.payments.retrieve(session.payment_id)

    // A sponsor slot needs the next billing date, which lives on the
    // subscription rather than the payment.
    let currentPeriodEnd: Date | null = null
    if (payment.subscription_id) {
      const subscription = await dodo.subscriptions.retrieve(payment.subscription_id)
      currentPeriodEnd = new Date(subscription.next_billing_date)
    }

    console.log(
      `  ${label}\n    SUCCEEDED — ${(payment.total_amount / 100).toFixed(2)} ` +
        `${payment.currency}${apply ? '' : '  (dry run)'}`,
    )

    if (apply) {
      const ok = await activatePurchase({
        checkoutId: sessionId,
        orderId: payment.payment_id,
        subscriptionId: payment.subscription_id,
        amountCents: payment.total_amount,
        currency: payment.currency,
        currentPeriodEnd,
      })
      console.log(`    ${ok ? 'granted' : 'row vanished, skipped'}\n`)
      if (ok) settled++
    } else {
      console.log('    would grant\n')
      settled++
    }
  }

  console.log(
    apply
      ? `Settled ${settled} purchase(s).\n`
      : `${settled} purchase(s) would be settled. Re-run with --fix to apply.\n`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
