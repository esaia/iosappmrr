import './load-env'
import { Polar } from '@polar-sh/sdk'

/**
 * Lists the Polar catalogue with the ids the app needs, and checks each product
 * is the right shape for the slot it fills.
 *
 * The dashboard shows a price but not whether it recurs, and not the id without
 * clicking into each product. Both matter here: the sponsor slot has to be a
 * subscription, because the rails read `current_period_end` to decide when a
 * sponsor drops off. A one-time product would sell a slot that never renews and
 * never expires.
 *
 * Reads the token from the environment and prints nothing secret, so its output
 * is safe to paste.
 */

const PRICE_KIND: Record<string, string> = {
  fixed: 'fixed',
  custom: 'pay what you want',
  free: 'free',
}

function formatPrice(product: { prices: Array<Record<string, unknown>> }) {
  const price = product.prices[0]
  if (!price) return 'no price'

  const amount = price.priceAmount
  const currency = typeof price.priceCurrency === 'string' ? price.priceCurrency : 'usd'
  if (typeof amount !== 'number') {
    return PRICE_KIND[String(price.amountType)] ?? String(price.amountType ?? 'unknown')
  }

  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
}

async function main() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    console.error('POLAR_ACCESS_TOKEN is not set. Add it to .env.local first.')
    process.exit(1)
  }

  const server = process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
  const polar = new Polar({ accessToken, server })

  console.log(`\nPolar catalogue (${server})\n`)

  const products: Array<{
    id: string
    name: string
    isRecurring: boolean
    recurringInterval: string | null
    isArchived: boolean
    prices: Array<Record<string, unknown>>
  }> = []

  for await (const page of await polar.products.list({ limit: 100 })) {
    products.push(...(page.result.items as unknown as typeof products))
  }

  if (products.length === 0) {
    console.log('No products found. Create them in the Polar dashboard first.\n')
    return
  }

  for (const product of products) {
    const billing = product.isRecurring
      ? `recurring / ${product.recurringInterval ?? 'unknown interval'}`
      : 'one-time'
    console.log(`  ${product.name}${product.isArchived ? '  [archived]' : ''}`)
    console.log(`    id       ${product.id}`)
    console.log(`    price    ${formatPrice(product)}`)
    console.log(`    billing  ${billing}\n`)
  }

  /*
   * Guess which product is which by shape rather than by name, then say so —
   * the names are the seller's to choose, but the billing period is not
   * negotiable for the sponsor slot.
   */
  const oneTime = products.filter((p) => !p.isRecurring && !p.isArchived)
  const recurring = products.filter((p) => p.isRecurring && !p.isArchived)

  console.log('Paste into .env.local:\n')
  console.log(`  POLAR_PRODUCT_DOFOLLOW=${oneTime[0]?.id ?? '<a one-time product>'}`)
  console.log(`  POLAR_PRODUCT_SPONSOR=${recurring[0]?.id ?? '<a recurring monthly product>'}\n`)

  if (recurring.length === 0) {
    console.error(
      'No recurring product found. The sponsor slot must be a monthly subscription:\n' +
        'a one-time product emits no subscription events, so a slot bought that way\n' +
        'would never renew, never expire, and never free itself up again.\n',
    )
    process.exitCode = 1
  }
  if (oneTime.length === 0) {
    console.error('No one-time product found for the dofollow link.\n')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
