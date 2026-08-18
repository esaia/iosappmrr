import './load-env'
import { and, eq, isNotNull } from 'drizzle-orm'
import { Polar } from '@polar-sh/sdk'
import { db } from '../src/db'
import { purchases } from '../src/db/schema'
import { activatePurchase } from '../src/lib/data/purchases'

/**
 * Settles purchases whose webhook never arrived.
 *
 * A webhook is a delivery, not a guarantee: the endpoint can be missing,
 * misconfigured, or down when an order is paid, and Polar only retries
 * deliveries to endpoints that existed at the time. Without a way to ask Polar
 * after the fact, a payment taken during any such window is stranded — money
 * charged, nothing granted, and no path to recovery.
 *
 * So this asks Polar the same question the webhook would have answered: for
 * every purchase still `pending`, is there a paid order against its checkout?
 * It calls the same `activatePurchase` the webhook does rather than reimplementing
 * the grant, so the two cannot drift apart, and that function is idempotent —
 * running this repeatedly, or alongside a webhook that later arrives, is safe.
 *
 *   npm run polar:reconcile          # report only
 *   npm run polar:reconcile -- --fix # apply
 */

/** Just the fields the grant needs, so the SDK's full Order type is not required. */
type PaidOrder = {
  id: string
  paid: boolean
  totalAmount: number
  currency: string
  subscriptionId: string | null
}

async function main() {
  const apply = process.argv.includes('--fix')
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    console.error('POLAR_ACCESS_TOKEN is not set.')
    process.exit(1)
  }

  const server = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
  const polar = new Polar({ accessToken, server })

  /*
   * Admin grants are excluded by the checkout-id filter rather than by source:
   * they never had a checkout, so there is nothing at Polar to reconcile them
   * against, and asking would only produce a confusing "no paid order" line.
   */
  const pending = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.status, 'pending'), isNotNull(purchases.polarCheckoutId)))

  if (pending.length === 0) {
    console.log('\nNo pending purchases. Nothing to reconcile.\n')
    return
  }

  console.log(`\nReconciling ${pending.length} pending purchase(s) against Polar (${server})\n`)

  let settled = 0

  for (const purchase of pending) {
    // Narrowed by the `isNotNull` filter above; TypeScript cannot see that.
    const checkoutId = purchase.polarCheckoutId!
    const orders = await polar.orders.list({ checkoutId, limit: 10 })

    let paidOrder: PaidOrder | null = null

    for await (const page of orders) {
      for (const order of page.result.items) {
        if (order.paid) {
          paidOrder = order as PaidOrder
          break
        }
      }
      if (paidOrder) break
    }

    const label = `${purchase.kind} / checkout ${checkoutId.slice(0, 8)}…`

    if (!paidOrder) {
      console.log(`  ${label}\n    no paid order — genuinely unpaid, leaving pending\n`)
      continue
    }

    // A sponsor slot needs the period end, which lives on the subscription
    // rather than the order.
    let currentPeriodEnd: Date | null = null
    if (paidOrder.subscriptionId) {
      const subscription = await polar.subscriptions.get({ id: paidOrder.subscriptionId })
      currentPeriodEnd = subscription.currentPeriodEnd ?? null
    }

    console.log(
      `  ${label}\n    PAID order ${paidOrder.id} — ${(paidOrder.totalAmount / 100).toFixed(2)} ` +
        `${paidOrder.currency.toUpperCase()}${apply ? '' : '  (dry run)'}`,
    )

    if (apply) {
      const ok = await activatePurchase({
        polarCheckoutId: checkoutId,
        polarOrderId: paidOrder.id,
        polarSubscriptionId: paidOrder.subscriptionId,
        amountCents: paidOrder.totalAmount,
        currency: paidOrder.currency,
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
