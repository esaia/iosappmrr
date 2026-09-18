import './load-env'
import DodoPayments from 'dodopayments'

/**
 * Checks the two configured Dodo products are the right shape for the slot
 * they fill.
 *
 * Unlike the previous provider, Dodo checkout takes a product id directly —
 * there is no separate price id to mix it up with. What is still worth
 * checking by hand is whether each product recurs the way the code expects:
 * the sponsor slot has to be a subscription, because the rails read
 * `current_period_end` to decide when a sponsor drops off. A one-time
 * product would sell a slot that never renews and never expires.
 *
 * Reads the key from the environment and prints nothing secret, so its output
 * is safe to paste.
 *
 *   npm run dodo:products
 */

const EXPECTED: Record<string, { env: string; recurring: boolean; why: string }> = {
  dofollow: {
    env: 'DODO_PRODUCT_DOFOLLOW',
    recurring: false,
    why: 'the dofollow flag never expires, so it is a one-time charge',
  },
  sponsor: {
    env: 'DODO_PRODUCT_SPONSOR',
    recurring: true,
    why: 'the rails read current_period_end, which only a subscription sets',
  },
}

async function main() {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY
  if (!apiKey) {
    console.error('\nDODO_PAYMENTS_API_KEY is not set.\n')
    process.exit(1)
  }

  const env = process.env.DODO_PAYMENTS_ENV === 'live_mode' ? 'live_mode' : 'test_mode'
  const dodo = new DodoPayments({ bearerToken: apiKey, environment: env })

  console.log(`\nDodo products (${env})\n`)

  let wrong = 0
  for (const [kind, expected] of Object.entries(EXPECTED)) {
    const configured = process.env[expected.env]
    if (!configured) {
      console.log(`  ${kind.padEnd(9)} ${expected.env} unset — not sold`)
      continue
    }

    let product
    try {
      product = await dodo.products.retrieve(configured)
    } catch {
      console.log(`  ${kind.padEnd(9)} ${configured} is not a product in this account`)
      wrong++
      continue
    }

    const ok = product.is_recurring === expected.recurring
    if (!ok) wrong++

    console.log(
      `  ${kind.padEnd(9)} ${product.product_id}  "${product.name ?? 'unnamed'}"` +
        `  ${product.is_recurring ? 'recurring' : 'one-time'}` +
        `  ${ok ? 'ok' : `WRONG — ${expected.why}`}`,
    )
  }

  console.log('')
  if (wrong) process.exit(1)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
