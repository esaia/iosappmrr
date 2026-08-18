import 'dotenv/config'
import Stripe from 'stripe'

/**
 * Creates a believable subscription book in a Stripe TEST account, so the
 * RevenueProvider path can be exercised end to end without a real business.
 *
 * Refuses to touch a live key. Everything it creates is tagged with
 * metadata.trustmrr_test so `--cleanup` can find and cancel it again.
 */

const TAG = 'trustmrr_test'

const PLANS = [
  { nickname: 'Starter monthly', unitAmount: 499, interval: 'month' as const, customers: 18 },
  { nickname: 'Pro monthly', unitAmount: 1499, interval: 'month' as const, customers: 11 },
  { nickname: 'Pro annual', unitAmount: 14_900, interval: 'year' as const, customers: 6 },
  { nickname: 'Team monthly', unitAmount: 4900, interval: 'month' as const, customers: 3 },
]

/** A few trials so the Trials metric has something to plot. */
const TRIAL_COUNT = 4

async function main() {
  const key = process.env.STRIPE_TEST_KEY
  if (!key) {
    throw new Error(
      'STRIPE_TEST_KEY is not set. Add your Stripe test secret key to .env.local:\n' +
        '  STRIPE_TEST_KEY=sk_test_...',
    )
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new Error('That is not a test key. This script refuses to run against live Stripe data.')
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 2 })
  const cleanup = process.argv.includes('--cleanup')

  if (cleanup) return teardown(stripe)

  const product = await stripe.products.create({
    name: 'TrustMRR iOS test subscription',
    metadata: { [TAG]: '1' },
  })
  console.log(`Product ${product.id}`)

  let created = 0
  let trials = 0
  let mrrCents = 0

  for (const plan of PLANS) {
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: plan.unitAmount,
      recurring: { interval: plan.interval },
      nickname: plan.nickname,
      metadata: { [TAG]: '1' },
    })

    for (let i = 0; i < plan.customers; i++) {
      const customer = await stripe.customers.create({
        name: `Test customer ${created + 1}`,
        email: `test-${Date.now()}-${created}@example.com`,
        // A test-mode token; no real card is involved.
        source: 'tok_visa',
        metadata: { [TAG]: '1' },
      })

      const shouldTrial = trials < TRIAL_COUNT && i === 0
      await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        ...(shouldTrial ? { trial_period_days: 14 } : {}),
        metadata: { [TAG]: '1' },
      })

      if (shouldTrial) {
        trials++
      } else {
        // Monthly equivalent, matching how the provider normalises annual plans.
        mrrCents += plan.interval === 'year' ? Math.round(plan.unitAmount / 12) : plan.unitAmount
      }
      created++
    }
    console.log(`  ${plan.nickname}: ${plan.customers} subscriptions`)
  }

  console.log(
    `\nDone. ${created} subscriptions (${trials} trialing).\n` +
      `Expected MRR once connected: $${(mrrCents / 100).toFixed(2)}\n\n` +
      `Next: /submit an app, then connect this same key on the dashboard.`,
  )
}

/** Cancels every subscription this script created and deactivates its prices. */
async function teardown(stripe: Stripe) {
  let cancelled = 0

  for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
    if (subscription.metadata?.[TAG] !== '1') continue
    if (subscription.status === 'canceled') continue
    await stripe.subscriptions.cancel(subscription.id)
    cancelled++
  }

  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata?.[TAG] !== '1' || !product.active) continue
    await stripe.products.update(product.id, { active: false })
  }

  console.log(`Cancelled ${cancelled} test subscriptions and archived their products.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
