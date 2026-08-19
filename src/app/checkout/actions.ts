'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createCheckout } from '@/lib/checkout'
import { getOwnedApp } from '@/lib/data/mutations'
import type { PurchaseKind } from '@/lib/polar'

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
  const user = await requireUser('/dashboard')
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  const result = await createCheckout(kind, app, user)
  if ('error' in result) return { error: result.error }

  redirect(result.url)
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
