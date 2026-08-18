'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getOwnedApp } from '@/lib/data/mutations'
import { getAppEntitlement, getSlotInventory, recordPendingPurchase } from '@/lib/data/purchases'
import { isPolarConfigured, polarClient, productId, type PurchaseKind } from '@/lib/polar'
import { site } from '@/lib/site'

export type CheckoutState = { error?: string }

/**
 * Opens a Polar checkout for one of the paid products.
 *
 * Every input that decides what is being bought and for whom is derived here
 * from the session and an ownership check, never from the form. The form
 * supplies only an app id, and an id the caller does not own is rejected
 * before a checkout exists.
 */
async function startCheckout(kind: PurchaseKind, appId: string): Promise<CheckoutState> {
  if (!isPolarConfigured(kind)) {
    return { error: 'Checkout is not available yet.' }
  }

  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  /*
   * Don't sell the same thing twice — Polar would happily take the money.
   *
   * A gift is the exception. Someone who was given a slot and then chooses to
   * pay for it is upgrading, not buying a duplicate: the payment takes over and
   * the gift is retired by `activatePurchase` once the webhook confirms it.
   * Refusing here would mean an admin's goodwill permanently blocked a founder
   * from becoming a customer.
   */
  const existing = await getAppEntitlement(appId, kind)

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
      metadata: { kind, appId, profileId: user.id },
    })
    checkoutId = checkout.id
    url = checkout.url
  } catch (error) {
    console.error('[polar] checkout creation failed', error)
    return { error: 'Could not reach the payment provider. Try again in a moment.' }
  }

  /*
   * Written before the redirect, not after: `redirect` works by throwing, so
   * anything below it never runs. The webhook can also beat the customer back
   * to the site, and it needs this row to already exist.
   */
  await recordPendingPurchase({ kind, appId, profileId: user.id, polarCheckoutId: checkoutId })

  redirect(url)
}

export async function startDofollowCheckout(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  return startCheckout('dofollow', String(formData.get('appId') ?? ''))
}

export async function startSponsorCheckout(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  return startCheckout('sponsor', String(formData.get('appId') ?? ''))
}
