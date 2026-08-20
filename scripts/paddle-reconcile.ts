import './load-env'
import { and, eq, isNotNull } from 'drizzle-orm'
import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import { db } from '../src/db'
import { purchases } from '../src/db/schema'
import { activatePurchase } from '../src/lib/data/purchases'

/**
 * Settles purchases whose webhook never arrived.
 *
 * A webhook is a delivery, not a guarantee: the endpoint can be missing,
 * misconfigured, or down when a transaction completes, and Paddle only retries
 * deliveries for a limited window. Without a way to ask Paddle after the fact,
 * a payment taken during any such window is stranded — money charged, nothing
 * granted, and no path to recovery.
 *
 * So this asks Paddle the same question the webhook would have answered: for
 * every purchase still `pending`, has its transaction been completed? It calls
 * the same `activatePurchase` the webhook does rather than reimplementing the
 * grant, so the two cannot drift apart, and that function is idempotent —
 * running this repeatedly, or alongside a webhook that later arrives, is safe.
 *
 *   npm run paddle:reconcile          # report only
 *   npm run paddle:reconcile -- --fix # apply
 */

async function main() {
  const apply = process.argv.includes('--fix')
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) {
    console.error('PADDLE_API_KEY is not set.')
    process.exit(1)
  }

  const env = process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'
  const paddle = new Paddle(apiKey, {
    environment: env === 'production' ? Environment.production : Environment.sandbox,
  })

  /*
   * Admin grants are excluded by the checkout-id filter rather than by source:
   * they never had a transaction, so there is nothing at Paddle to reconcile
   * them against, and asking would only produce a confusing "not paid" line.
   */
  const pending = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.status, 'pending'), isNotNull(purchases.checkoutId)))

  if (pending.length === 0) {
    console.log('\nNo pending purchases. Nothing to reconcile.\n')
    return
  }

  console.log(`\nReconciling ${pending.length} pending purchase(s) against Paddle (${env})\n`)

  let settled = 0

  for (const purchase of pending) {
    // Narrowed by the `isNotNull` filter above; TypeScript cannot see that.
    const transactionId = purchase.checkoutId!
    const label = `${purchase.kind} / transaction ${transactionId.slice(0, 12)}…`

    let transaction
    try {
      transaction = await paddle.transactions.get(transactionId)
    } catch {
      console.log(`  ${label}\n    no such transaction at Paddle, leaving pending\n`)
      continue
    }

    /*
     * `completed` is the only status that means the customer has what they
     * bought. `billed` and `paid` are money in motion, and granting on either
     * would hand out a link for a payment that can still fall over.
     */
    if (transaction.status !== 'completed') {
      console.log(`  ${label}\n    status ${transaction.status} — not settled, leaving pending\n`)
      continue
    }

    // A sponsor slot needs the period end, which lives on the subscription
    // rather than the transaction.
    let currentPeriodEnd: Date | null = null
    if (transaction.subscriptionId) {
      const subscription = await paddle.subscriptions.get(transaction.subscriptionId)
      const endsAt = subscription.currentBillingPeriod?.endsAt
      currentPeriodEnd = endsAt ? new Date(endsAt) : null
    }

    const total = transaction.details?.totals?.total ?? '0'
    console.log(
      `  ${label}\n    COMPLETED — ${(Number(total) / 100).toFixed(2)} ` +
        `${transaction.currencyCode}${apply ? '' : '  (dry run)'}`,
    )

    if (apply) {
      const ok = await activatePurchase({
        checkoutId: transactionId,
        orderId: transaction.id,
        subscriptionId: transaction.subscriptionId,
        amountCents: Math.round(Number(total)),
        currency: transaction.currencyCode,
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
