import 'server-only'
import { getAppEntitlement, getSlotInventory, recordPendingPurchase } from '@/lib/data/purchases'
import { isPolarConfigured, polarClient, productId, type PurchaseKind } from '@/lib/polar'
import { site } from '@/lib/site'

export type CheckoutResult = { url: string } | { error: string }

/**
 * Opens a Polar checkout for one paid product and records it as pending.
 *
 * Shared by the edit screen's upgrade buttons and by the submit form, which
 * offers the dofollow link as part of listing an app. Both arrive here with an
 * app the caller has already proved the signed-in founder owns — this function
 * takes ids, never a form, so there is no path where the buyer names the app.
 *
 * Returns the URL rather than redirecting, because the callers differ in what
 * they do when a checkout cannot be opened: one reports it beside a button,
 * the other has just verified an app and must not lose that.
 */
export async function createCheckout(
  kind: PurchaseKind,
  app: { id: string },
  user: { id: string; email?: string | null },
): Promise<CheckoutResult> {
  if (!isPolarConfigured(kind)) return { error: 'Checkout is not available yet.' }

  /*
   * Don't sell the same thing twice — Polar would happily take the money.
   *
   * A gift is the exception. Someone who was given a slot and then chooses to
   * pay for it is upgrading, not buying a duplicate: the payment takes over and
   * the gift is retired by `activatePurchase` once the webhook confirms it.
   * Refusing here would mean an admin's goodwill permanently blocked a founder
   * from becoming a customer.
   */
  const existing = await getAppEntitlement(app.id, kind)

  if (existing?.source === 'polar') {
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

  let checkoutId: string
  let url: string
  try {
    const checkout = await polarClient().checkouts.create({
      products: [productId(kind)],
      successUrl: `${site.url}/checkout/success?checkout_id={CHECKOUT_ID}`,
      customerEmail: user.email ?? undefined,
      // Ties the Polar customer to the founder, so a second purchase reuses
      // the same customer record rather than creating a duplicate.
      externalCustomerId: user.id,
      metadata: { kind, appId: app.id, profileId: user.id },
    })
    checkoutId = checkout.id
    url = checkout.url
  } catch (error) {
    console.error('[polar] checkout creation failed', error)
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
    polarCheckoutId: checkoutId,
  })

  return { url }
}

/**
 * A signed link into Polar's customer portal — invoices, receipts, and card
 * details, all of which live at Polar rather than here.
 *
 * Keyed by `externalCustomerId`, the same id every checkout is created with, so
 * the founder sees every purchase they have made rather than one product's.
 * Returns an error rather than throwing when they have bought nothing yet:
 * Polar has no customer to open a portal for, and that is an ordinary state for
 * someone who has only ever listed a free app.
 */
export async function createBillingPortalSession(user: { id: string }): Promise<CheckoutResult> {
  if (!process.env.POLAR_ACCESS_TOKEN) return { error: 'Billing is not available yet.' }

  try {
    const session = await polarClient().customerSessions.create({
      externalCustomerId: user.id,
      returnUrl: `${site.url}/account`,
    })
    return { url: session.customerPortalUrl }
  } catch (error) {
    console.error('[polar] customer session failed', error)
    return { error: 'No billing history yet, or the payment provider is unreachable.' }
  }
}

/**
 * Turns a sponsor's auto-renew off, or back on.
 *
 * Cancelling is never an immediate revoke: the founder has paid through the end
 * of the period and the rails should keep showing them until then. Polar sends
 * `subscription.revoked` when the period actually ends, and the webhook is what
 * withdraws the slot — nothing here touches the entitlement.
 *
 * The same call resumes it, which is why this takes a flag rather than being
 * two functions. Polar treats uncancelling as clearing the same field, and a
 * period that has not ended yet was never interrupted, so resuming costs
 * nothing and starts no new billing period.
 */
export async function setSubscriptionCancellation(
  polarSubscriptionId: string,
  cancelAtPeriodEnd: boolean,
): Promise<{ error?: string }> {
  try {
    await polarClient().subscriptions.update({
      id: polarSubscriptionId,
      subscriptionUpdate: { cancelAtPeriodEnd },
    })
    return {}
  } catch (error) {
    console.error('[polar] subscription cancel toggle failed', error)
    return { error: 'Could not reach the payment provider. Try again in a moment.' }
  }
}
