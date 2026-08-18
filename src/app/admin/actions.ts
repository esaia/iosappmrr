'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps } from '@/db/schema'
import { requireAdmin } from '@/lib/auth'
import { getAdminApp, logAdminAction, type AdminActor } from '@/lib/data/admin'
import {
  activatePurchaseById,
  getSlotInventory,
  grantPurchase,
  hasActivePurchase,
  revokeActivePurchasesForApp,
  revokePurchaseById,
} from '@/lib/data/purchases'
import { setSetting, SETTING_LIMITS } from '@/lib/settings'

export type AdminState = { error?: string; ok?: string }

/**
 * Establishes that the caller is an admin and returns them as an audit actor.
 *
 * Called at the top of every action in this file. Server actions are public
 * HTTP endpoints — being reachable only from a page behind `requireAdmin`
 * protects the page, not the action, and anyone who has seen the page knows the
 * action's id.
 */
async function actor(): Promise<AdminActor> {
  const user = await requireAdmin()
  return { id: user.id, handle: user.profile.handle }
}

/** The public surfaces that a paid placement or a status change can alter. */
function revalidatePublic(slug?: string | null) {
  revalidatePath('/')
  revalidatePath('/apps')
  revalidatePath('/leaderboard')
  if (slug) revalidatePath(`/apps/${slug}`)
}

function revalidateAdmin() {
  revalidatePath('/admin', 'layout')
}

/* -------------------------------------------------------------------------- */
/*                                    Apps                                     */
/* -------------------------------------------------------------------------- */

const APP_STATUSES = ['draft', 'pending', 'live', 'hidden'] as const
type AppStatus = (typeof APP_STATUSES)[number]

export async function setAppStatusAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')
  const status = String(formData.get('status') ?? '')

  if (!APP_STATUSES.includes(status as AppStatus)) return { error: 'Unknown status.' }

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }
  if (app.status === status) return { ok: `Already ${status}.` }

  await db
    .update(apps)
    .set({ status: status as AppStatus, updatedAt: new Date() })
    .where(eq(apps.id, appId))

  await logAdminAction(admin, {
    action: 'set_app_status',
    summary: `Set ${app.name} to ${status} (was ${app.status})`,
    targetType: 'app',
    targetId: appId,
    detail: { from: app.status, to: status },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()
  return { ok: `${app.name} is now ${status}.` }
}

/* -------------------------------------------------------------------------- */
/*                            Gifts and entitlements                           */
/* -------------------------------------------------------------------------- */

/**
 * Gives an app a dofollow link without charging for it.
 *
 * Recorded as an admin-sourced purchase rather than by flipping the app's flag,
 * so the gift shows up in the ledger, can be withdrawn by the same code that
 * handles refunds, and is not silently indistinguishable from a sale.
 */
export async function giftDofollowAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }
  if (await hasActivePurchase(appId, 'dofollow')) {
    return { error: `${app.name} already has a dofollow link.` }
  }

  await grantPurchase({
    kind: 'dofollow',
    appId,
    // The gift belongs to the founder who owns the app, not to the admin
    // handing it over — otherwise it would look like the admin bought it.
    profileId: app.founderId,
    grantedBy: admin.id,
    note,
  })

  await logAdminAction(admin, {
    action: 'grant_dofollow',
    summary: `Gifted a dofollow link to ${app.name} (@${app.founderHandle})`,
    targetType: 'app',
    targetId: appId,
    detail: { note },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()
  return { ok: `${app.name} now has a dofollow link.` }
}

export async function revokeDofollowAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }

  const revoked = await revokeActivePurchasesForApp(appId, 'dofollow', note)

  /*
   * Some listings carry the flag with no purchase behind it — seeded rows, or
   * a value set before purchases existed. Revoking nothing would leave the link
   * live and the button apparently broken, so clear the flag directly too.
   */
  if (revoked === 0 && app.websiteDofollow) {
    await db.update(apps).set({ websiteDofollow: false }).where(eq(apps.id, appId))
  }

  await logAdminAction(admin, {
    action: 'revoke_dofollow',
    summary: `Removed the dofollow link from ${app.name}`,
    targetType: 'app',
    targetId: appId,
    detail: { purchasesRevoked: revoked, note },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()
  return { ok: `Dofollow removed from ${app.name}.` }
}

/**
 * Gives an app a sponsor rail slot without charging for it.
 *
 * The slot cap is checked the same way checkout checks it, so a gift cannot
 * quietly oversell the rails — if there is no room, raise the slot count on the
 * settings screen first. That is a deliberate two-step: overselling would mean
 * every paying sponsor gets less rotation than they bought.
 */
export async function giftSponsorAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null
  const rawDays = String(formData.get('days') ?? '').trim()

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }
  if (app.status !== 'live') {
    return { error: 'Only a live app can sponsor a rail — its listing is what the rail shows.' }
  }
  if (await hasActivePurchase(appId, 'sponsor')) {
    return { error: `${app.name} already holds a sponsor slot.` }
  }

  const { slots, free } = await getSlotInventory()
  if (free <= 0) {
    return { error: `All ${slots} sponsor slots are taken. Raise the count in Settings first.` }
  }

  let currentPeriodEnd: Date | null = null
  if (rawDays) {
    const days = Number(rawDays)
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return { error: 'Duration must be between 1 and 3650 days, or blank for no expiry.' }
    }
    currentPeriodEnd = new Date(Date.now() + Math.round(days) * 86_400_000)
  }

  await grantPurchase({
    kind: 'sponsor',
    appId,
    profileId: app.founderId,
    grantedBy: admin.id,
    note,
    currentPeriodEnd,
  })

  await logAdminAction(admin, {
    action: 'grant_sponsor',
    summary: `Gifted a sponsor slot to ${app.name} (@${app.founderHandle})${
      currentPeriodEnd ? ` for ${rawDays} days` : ' with no expiry'
    }`,
    targetType: 'app',
    targetId: appId,
    detail: { note, currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()
  return { ok: `${app.name} is now sponsoring the rails.` }
}

export async function revokeSponsorAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }

  const revoked = await revokeActivePurchasesForApp(appId, 'sponsor', note)
  if (revoked === 0) return { error: `${app.name} does not hold a sponsor slot.` }

  await logAdminAction(admin, {
    action: 'revoke_sponsor',
    summary: `Took the sponsor slot back from ${app.name}`,
    targetType: 'app',
    targetId: appId,
    detail: { purchasesRevoked: revoked, note },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()
  return { ok: `Sponsor slot released.` }
}

/* -------------------------------------------------------------------------- */
/*                             Purchases (repair)                              */
/* -------------------------------------------------------------------------- */

/**
 * Settles a stuck checkout by hand.
 *
 * `npm run polar:reconcile` is the right tool when Polar can still see the
 * order — it checks that the money actually arrived. This grants without that
 * check, so it is for the case where you have confirmed the payment yourself
 * and Polar's API cannot close the loop. The note is required for exactly that
 * reason: the log should say what the evidence was.
 */
export async function settlePurchaseAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const id = String(formData.get('purchaseId') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!note) return { error: 'Add a note saying how the payment was confirmed.' }

  const ok = await activatePurchaseById(id, note)
  if (!ok) return { error: 'Purchase not found.' }

  await logAdminAction(admin, {
    action: 'settle_purchase',
    summary: `Settled a stuck purchase by hand — ${note}`,
    targetType: 'purchase',
    targetId: id,
    detail: { note },
  })

  revalidatePublic()
  revalidateAdmin()
  return { ok: 'Purchase settled and the benefit granted.' }
}

export async function revokePurchaseAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const id = String(formData.get('purchaseId') ?? '')
  const note = String(formData.get('note') ?? '').trim() || null

  const ok = await revokePurchaseById(id, note)
  if (!ok) return { error: 'Purchase not found.' }

  await logAdminAction(admin, {
    action: 'revoke_purchase',
    summary: `Revoked a purchase${note ? ` — ${note}` : ''}`,
    targetType: 'purchase',
    targetId: id,
    detail: { note },
  })

  revalidatePublic()
  revalidateAdmin()
  return { ok: 'Purchase revoked.' }
}

/* -------------------------------------------------------------------------- */
/*                                  Settings                                   */
/* -------------------------------------------------------------------------- */

/**
 * Changes how many sponsor slots are on sale.
 *
 * Raising it puts the extra spots up for sale immediately. Lowering it below
 * the number already sold does not evict anyone — it stops new checkouts and
 * lets the count fall back naturally, because taking a slot from someone
 * mid-month is a refund, not a setting.
 */
export async function setSponsorSlotsAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const raw = String(formData.get('slots') ?? '').trim()
  const value = Number(raw)
  const { min, max } = SETTING_LIMITS.sponsor_slots

  if (!Number.isFinite(value) || value < min || value > max) {
    return { error: `Enter a whole number between ${min} and ${max}.` }
  }

  const { slots: before, booked: taken } = await getSlotInventory()
  const saved = await setSetting('sponsor_slots', value, admin.id)

  await logAdminAction(admin, {
    action: 'set_sponsor_slots',
    summary: `Changed sponsor slots from ${before} to ${saved}`,
    targetType: 'setting',
    targetId: 'sponsor_slots',
    detail: { from: before, to: saved },
  })

  revalidatePublic()
  revalidateAdmin()

  return {
    ok:
      taken > saved
        ? `Saved. ${taken} slots are already booked, so nothing new sells until that falls to ${saved}.`
        : `Saved. ${saved - taken} of ${saved} slots are available.`,
  }
}
