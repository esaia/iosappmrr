import 'server-only'
import { getAppEntitlement, getSlotInventory, recordPendingPurchase } from '@/lib/data/purchases'
import { isPaddleConfigured, paddleClient, priceId, type PurchaseKind } from '@/lib/paddle'
import { site } from '@/lib/site'

export type CheckoutResult = { url: string } | { error: string }

/** The page that loads Paddle.js and opens the overlay for a transaction. */
const PAY_PAGE = `${site.url}/checkout/pay`

/**
 * Finds the Paddle customer for a founder, or makes one.
 *
 * Paddle has no field for a foreign id on a customer, so email is the join —
 * and Paddle enforces it as unique, which is what makes this safe to call on
 * every checkout. The create is attempted only after the lookup misses, and a
 * miss that turns into a conflict (two checkouts opened at once) falls back to
 * looking again rather than failing the purchase.
 */
async function findOrCreateCustomer(email: string) {
  const paddle = paddleClient()

  const existing = await paddle.customers.list({ email: [email] }).next()
  if (existing[0]) return existing[0].id

  try {
    const created = await paddle.customers.create({ email })
    return created.id
  } catch {
    const raced = await paddle.customers.list({ email: [email] }).next()
    if (raced[0]) return raced[0].id
    throw new Error(`Could not find or create a Paddle customer for ${email}.`)
  }
}

/**
 * Opens a Paddle checkout for one paid product and records it as pending.
 *
 * Shared by the edit screen's upgrade buttons and by the submit form, which
 * offers the dofollow link as part of listing an app. Both arrive here with an
 * app the caller has already proved the signed-in founder owns — this function
 * takes ids, never a form, so there is no path where the buyer names the app.
 *
 * Returns the URL rather than redirecting, because the callers differ in what
 * they do when a checkout cannot be opened: one reports it beside a button,
 * the other has just verified an app and must not lose that.
 *
 * The URL is one of ours. Paddle does not host a checkout page — it opens over
 * a page carrying Paddle.js, so the transaction is created here and handed to
 * `/checkout/pay` in the `_ptxn` parameter Paddle appends.
 */
export async function createCheckout(
  kind: PurchaseKind,
  app: { id: string },
  user: { id: string; email?: string | null },
): Promise<CheckoutResult> {
  if (!isPaddleConfigured(kind)) return { error: 'Checkout is not available yet.' }

  /*
   * Don't sell the same thing twice — Paddle would happily take the money.
   *
   * A gift is the exception. Someone who was given a slot and then chooses to
   * pay for it is upgrading, not buying a duplicate: the payment takes over and
   * the gift is retired by `activatePurchase` once the webhook confirms it.
   * Refusing here would mean an admin's goodwill permanently blocked a founder
   * from becoming a customer.
   */
  const existing = await getAppEntitlement(app.id, kind)

  if (existing?.source === 'paddle') {
    return {
      error:
        kind === 'dofollow'
          ? 'This app already has a dofollow link.'
          : 'This app already sponsors a rail.',
    }
  }

  const upgradingFromGift = existing?.source === 'admin'

  if (kind === 'sponsor' && !upgradingFromGift) {
    /*
     * Skipped when upgrading: the gift already occupies a slot, so the paid row
     * that replaces it is net zero. Charging the cap twice would tell a founder
     * the rails were full while they were standing in one of them.
     */
    const { free } = await getSlotInventory()
    if (free <= 0) return { error: 'All sponsor spots are currently taken.' }
  }

  let transactionId: string
  let url: string
  try {
    const paddle = paddleClient()

    /*
     * A customer up front, rather than letting the overlay collect an email.
     * It prefills the checkout, and it is what ties a second purchase to the
     * same customer record instead of creating a duplicate — the job
     * `externalCustomerId` did at Paddle.
     */
    const customerId = user.email ? await findOrCreateCustomer(user.email) : undefined

    const transaction = await paddle.transactions.create({
      items: [{ priceId: priceId(kind), quantity: 1 }],
      customerId,
      customData: { kind, appId: app.id, profileId: user.id },
      /*
       * Which page the checkout opens over. It does not replace the account's
       * default payment link — Paddle refuses to create any transaction until
       * that is set in the dashboard, whatever this says — but it is what lets
       * a local run send the customer to localhost while production sends them
       * to the deployed page.
       */
      checkout: { url: PAY_PAGE },
    })

    if (!transaction.checkout?.url) {
      throw new Error('Paddle returned a transaction with no checkout URL.')
    }

    transactionId = transaction.id
    url = transaction.checkout.url
  } catch (error) {
    console.error('[paddle] checkout creation failed', error)
    return { error: 'Could not reach the payment provider. Try again in a moment.' }
  }

  /*
   * Written before the caller redirects. The webhook can beat the customer back
   * to the site, and it needs this row to already exist.
   */
  await recordPendingPurchase({
    kind,
    appId: app.id,
    profileId: user.id,
    checkoutId: transactionId,
  })

  return { url }
}

/**
 * A signed link into Paddle's customer portal — invoices, receipts, and card
 * details, all of which live at Paddle rather than here.
 *
 * Keyed by the customer Paddle holds for this founder's email, the same one
 * every checkout is created against, so they see every purchase they have made
 * rather than one product's. Returns an error rather than throwing when they
 * have bought nothing yet: there is no customer to open a portal for, and that
 * is an ordinary state for someone who has only ever listed a free app.
 */
export async function createBillingPortalSession(user: {
  id: string
  email?: string | null
}): Promise<CheckoutResult> {
  if (!process.env.PADDLE_API_KEY || !user.email) return { error: 'Billing is not available yet.' }

  try {
    const paddle = paddleClient()

    const [customer] = await paddle.customers.list({ email: [user.email] }).next()
    if (!customer) return { error: 'No billing history yet.' }

    // Empty list: the portal shows every subscription the customer has, which
    // is what "manage my billing" should mean. Naming some would hide the rest.
    const session = await paddle.customerPortalSessions.create(customer.id, [])

    return { url: session.urls.general.overview }
  } catch (error) {
    console.error('[paddle] customer portal session failed', error)
    return { error: 'No billing history yet, or the payment provider is unreachable.' }
  }
}

/**
 * Turns a sponsor's auto-renew off, or back on.
 *
 * Cancelling is never an immediate revoke: the founder has paid through the end
 * of the period and the rails should keep showing them until then. Paddle takes
 * that as `effective_from: next_billing_period`, holds it as a scheduled
 * change, and sends `subscription.canceled` when the period actually ends — the
 * webhook is what withdraws the slot, so nothing here touches the entitlement.
 *
 * Resuming is clearing that scheduled change, which is why this takes a flag
 * rather than being two functions. A period that has not ended yet was never
 * interrupted, so resuming costs nothing and starts no new billing period.
 */
export async function setSubscriptionCancellation(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean,
): Promise<{ error?: string }> {
  try {
    const paddle = paddleClient()

    if (cancelAtPeriodEnd) {
      await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: 'next_billing_period' })
    } else {
      await paddle.subscriptions.update(subscriptionId, { scheduledChange: null })
    }

    return {}
  } catch (error) {
    console.error('[paddle] subscription cancel toggle failed', error)
    return { error: 'Could not reach the payment provider. Try again in a moment.' }
  }
}
