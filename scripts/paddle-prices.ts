import './load-env'
import { Environment, Paddle } from '@paddle/paddle-node-sdk'

/**
 * Lists the Paddle catalogue with the ids the app needs, and checks each price
 * is the right shape for the slot it fills.
 *
 * The dashboard shows an amount but not whether it recurs, and not the id
 * without clicking into each price. Both matter here: the sponsor slot has to
 * be a subscription, because the rails read `current_period_end` to decide when
 * a sponsor drops off. A one-time price would sell a slot that never renews and
 * never expires.
 *
 * Reads the key from the environment and prints nothing secret, so its output
 * is safe to paste.
 *
 *   npm run paddle:prices
 */

/** What each configured price has to be, for the code that reads it to work. */
const EXPECTED: Record<string, { env: string; recurring: boolean; why: string }> = {
  dofollow: {
    env: 'PADDLE_PRICE_DOFOLLOW',
    recurring: false,
    why: 'the dofollow flag never expires, so it is a one-time charge',
  },
  sponsor: {
    env: 'PADDLE_PRICE_SPONSOR',
    recurring: true,
    why: 'the rails read current_period_end, which only a subscription sets',
  },
}

async function main() {
  const apiKey = process.env.PADDLE_API_KEY
  if (!apiKey) {
    console.error('\nPADDLE_API_KEY is not set.\n')
    process.exit(1)
  }

  const env = process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox'
  const paddle = new Paddle(apiKey, {
    environment: env === 'production' ? Environment.production : Environment.sandbox,
  })

  console.log(`\nPaddle catalogue (${env})\n`)

  const prices = await paddle.prices.list({ status: ['active'], include: ['product'] }).next()

  if (prices.length === 0) {
    console.log('  No active prices. Create them in Paddle, or with the API.\n')
    return
  }

  for (const price of prices) {
    const cycle = price.billingCycle
      ? `every ${price.billingCycle.frequency} ${price.billingCycle.interval}`
      : 'one-time'
    const amount = Number(price.unitPrice.amount) / 100

    console.log(`  ${price.product?.name ?? 'unknown product'}`)
    console.log(`    price   ${price.id}`)
    console.log(`    amount  ${amount.toFixed(2)} ${price.unitPrice.currencyCode}  (${cycle})`)
  }

  console.log('\nConfigured for sale:\n')

  let wrong = 0
  for (const [kind, expected] of Object.entries(EXPECTED)) {
    const configured = process.env[expected.env]
    if (!configured) {
      console.log(`  ${kind.padEnd(9)} ${expected.env} unset — not sold`)
      continue
    }

    const price = prices.find((p) => p.id === configured)
    if (!price) {
      console.log(`  ${kind.padEnd(9)} ${configured} is not an active price in this account`)
      wrong++
      continue
    }

    const recurring = Boolean(price.billingCycle)
    const ok = recurring === expected.recurring
    if (!ok) wrong++

    console.log(
      `  ${kind.padEnd(9)} ${price.id}  ${recurring ? 'recurring' : 'one-time'}` +
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
