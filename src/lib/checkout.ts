import 'server-only'
import { getAppEntitlement, getSlotInventory, recordPendingPurchase } from '@/lib/data/purchases'
import { dodoClient, isDodoConfigured, productId, type PurchaseKind } from '@/lib/dodo'
import { site } from '@/lib/site'

export type CheckoutResult = { url: string } | { error: string }

/**
 * Opens a Dodo checkout for one paid product and records it as pending.
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
 * The URL is Dodo's own hosted checkout page — unlike the previous provider,
 * nothing here needs to draw a payment form of its own.
 */
export async function createCheckout(
  kind: PurchaseKind,
  app: { id: string },
  user: { id: string; email?: string | null },
): Promise<CheckoutResult> {
  if (!isDodoConfigured(kind)) return { error: 'Checkout is not available yet.' }

  /*
   * Don't sell the same thing twice — Dodo would happily take the money.
   *
   * A gift is the exception. Someone who was given a slot and then chooses to
   * pay for it is upgrading, not buying a duplicate: the payment takes over and
   * the gift is retired by `activatePurchase` once the webhook confirms it.
   * Refusing here would mean an admin's goodwill permanently blocked a founder
   * from becoming a customer.
   */
  const existing = await getAppEntitlement(app.id, kind)

  if (existing && existing.source !== 'admin') {
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

  let sessionId: string
  let url: string
  try {
    const dodo = dodoClient()

    /*
     * Passing the email lets Dodo find the existing customer by it (the
     * default behaviour) rather than creating a duplicate for a second
     * purchase, so there is no need to look one up by hand first.
     */
    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId(kind), quantity: 1 }],
      customer: user.email ? { email: user.email } : undefined,
      metadata: { kind, appId: app.id, profileId: user.id },
      return_url: `${site.url}/checkout/success`,
    })

    if (!session.checkout_url) {
      throw new Error('Dodo returned a checkout session with no checkout URL.')
    }

    sessionId = session.session_id
    url = session.checkout_url
  } catch (error) {
    console.error('[dodo] checkout creation failed', error)
    return { error: checkoutFailureMessage(error) }
  }

  /*
   * Written before the caller redirects. The webhook can beat the customer
   * back to the site, and it needs this row to already exist.
   */
  await recordPendingPurchase({
    kind,
    appId: app.id,
    profileId: user.id,
    checkoutId: sessionId,
    source: 'dodo',
  })

  return { url }
}

/**
 * Turns a Dodo failure into a sentence that names the thing to go and fix.
 *
 * A founder mid-purchase cannot act on a raw API error, so this only names the
 * handful of cases that are a dashboard setting rather than a passing outage —
 * everything else keeps the vague sentence on purpose, and the log has the
 * detail.
 */
function checkoutFailureMessage(error: unknown) {
  const status = (error as { status?: number })?.status

  if (status === 401 || status === 403) {
    return 'Checkout is not set up yet: the payment provider has not finished approving this account.'
  }

  if (status === 404 || status === 422) {
    return 'Checkout is not set up correctly. The product id on file does not match anything in Dodo.'
  }

  return 'Could not reach the payment provider. Try again in a moment.'
}

/**
 * A signed link into Dodo's customer portal — invoices, receipts, and card
 * details, all of which live at Dodo rather than here.
 *
 * Keyed by the customer Dodo holds for this founder's email, the same one
 * every checkout is created against, so they see every purchase they have made
 * rather than one product's. Returns an error rather than throwing when they
 * have bought nothing yet: there is no customer to open a portal for, and that
 * is an ordinary state for someone who has only ever listed a free app.
 */
export async function createBillingPortalSession(user: {
  id: string
  email?: string | null
}): Promise<CheckoutResult> {
  if (!process.env.DODO_PAYMENTS_API_KEY || !user.email) {
    return { error: 'Billing is not available yet.' }
  }

  try {
    const dodo = dodoClient()

    const customers = await dodo.customers.list({ email: user.email })
    const customer = customers.items[0]
    if (!customer) return { error: 'No billing history yet.' }

    const session = await dodo.customers.customerPortal.create(customer.customer_id)

    return { url: session.link }
  } catch (error) {
    console.error('[dodo] customer portal session failed', error)
    return { error: 'No billing history yet, or the payment provider is unreachable.' }
  }
}

/**
 * Turns a sponsor's auto-renew off, or back on.
 *
 * Cancelling is never an immediate revoke: the founder has paid through the
 * end of the period and the rails should keep showing them until then. Dodo
 * takes that as `cancel_at_next_billing_date`, holds it as a scheduled
 * change, and sends `subscription.cancelled` when the period actually ends —
 * the webhook is what withdraws the slot, so nothing here touches the
 * entitlement.
 *
 * Resuming is clearing that same flag, which is why this takes a boolean
 * rather than being two functions.
 */
export async function setSubscriptionCancellation(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean,
): Promise<{ error?: string }> {
  try {
    const dodo = dodoClient()
    await dodo.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: cancelAtPeriodEnd,
    })
    return {}
  } catch (error) {
    console.error('[dodo] subscription cancel toggle failed', error)
    return { error: 'Could not reach the payment provider. Try again in a moment.' }
  }
}
