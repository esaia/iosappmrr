'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, profiles } from '@/db/schema'
import { fetchAppStoreReviews } from '@/lib/appstore/reviews'
import { requireAdmin } from '@/lib/auth'
import { countAdmins, getAdminApp, logAdminAction, type AdminActor } from '@/lib/data/admin'
import {
  activatePurchaseById,
  getAppEntitlement,
  getSlotInventory,
  grantPurchase,
  revokeActivePurchasesForApp,
  revokePurchaseById,
} from '@/lib/data/purchases'
import { saveAppStoreReviews } from '@/lib/data/mutations'
import { getVerdict, getVerdictInput, saveVerdict } from '@/lib/data/vibecode'
import { setSetting, SETTING_LIMITS } from '@/lib/settings'
import { DEFAULT_MODEL, draftVerdict, isConfigured, verdictLabel } from '@/lib/vibecode'

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

  const existing = await getAppEntitlement(appId, 'dofollow')
  if (existing) {
    return {
      error:
        existing.source === 'paddle'
          ? `${app.name} already paid for a dofollow link — there is nothing to gift.`
          : `${app.name} already has a gifted dofollow link.`,
    }
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

  const existing = await getAppEntitlement(appId, 'dofollow')
  if (existing?.source === 'paddle') {
    return {
      error: `${app.name} paid for this link. Refund it in Paddle, or revoke the purchase from the Purchases screen if you mean to.`,
    }
  }

  const revoked = await revokeActivePurchasesForApp(appId, 'dofollow', note, 'admin')

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
  const existing = await getAppEntitlement(appId, 'sponsor')
  if (existing) {
    return {
      error:
        existing.source === 'paddle'
          ? `${app.name} is a paying sponsor — there is nothing to gift.`
          : `${app.name} already holds a gifted sponsor slot.`,
    }
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

  /*
   * A slot someone is paying for is not the admin's to switch off. It ends when
   * the subscription ends, and Paddle's webhook is what tells us that — which
   * also means a cancellation or refund already removes it without anyone
   * clicking anything here.
   */
  const existing = await getAppEntitlement(appId, 'sponsor')
  if (existing?.source === 'paddle') {
    return {
      error: `${app.name} pays for this slot. It ends when their subscription does — cancel or refund it in Paddle instead.`,
    }
  }

  const revoked = await revokeActivePurchasesForApp(appId, 'sponsor', note, 'admin')
  if (revoked === 0) return { error: `${app.name} does not hold a gifted sponsor slot.` }

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
 * `npm run paddle:reconcile` is the right tool when Paddle can still see the
 * order — it checks that the money actually arrived. This grants without that
 * check, so it is for the case where you have confirmed the payment yourself
 * and Paddle's API cannot close the loop. The note is required for exactly that
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

/* -------------------------------------------------------------------------- */
/*                          App Store reviews & verdict                        */
/* -------------------------------------------------------------------------- */

/**
 * Re-reads an app's App Store reviews on demand.
 *
 * The nightly sync reads a listing's reviews once and then leaves it alone,
 * because each read is an 800KB scrape of a page Apple serves for browsers.
 * This is the escape hatch for when a founder asks: one app, one click, one
 * request — rather than putting every listing back on a nightly schedule.
 */
export async function refetchReviewsAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }
  if (!app.appStoreId) return { error: 'This app has no App Store ID to read.' }

  const found = await fetchAppStoreReviews(app.appStoreId).catch(() => null)
  if (!found) {
    // Deliberately not stamped as read: leaving it unset lets the nightly sync
    // pick the app up again, and lets this button be pressed again now.
    return {
      error: 'The App Store page could not be read. It may have moved, or Apple changed the page.',
    }
  }

  await saveAppStoreReviews(app.id, found)

  await logAdminAction(admin, {
    action: 'refetch_reviews',
    summary: `Refetched App Store reviews for ${app.name} (${found.reviews.length} found)`,
    targetType: 'app',
    targetId: appId,
    detail: { count: found.reviews.length, histogram: found.histogram },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()

  return {
    ok: found.reviews.length
      ? `Stored ${found.reviews.length} review${found.reviews.length === 1 ? '' : 's'}.`
      : 'Read the page — Apple is showing no reviews for this app.',
  }
}

/**
 * Drafts the "Can I vibecode it?" verdict for one app.
 *
 * Verdicts are never generated on the render path, so until now they only came
 * into being through `npm run vibecode`. This runs the same draft for a single
 * app from the screen where an admin is already looking at it.
 *
 * A verdict a human has edited is not overwritten. The model's opinion does not
 * outrank a correction someone made to a claim about their own app — clear the
 * edit first if you really want it redrafted.
 */
export async function draftVerdictAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()
  const appId = String(formData.get('appId') ?? '')

  if (!isConfigured()) return { error: 'OPENAI_API_KEY is not set on this deployment.' }

  const app = await getAdminApp(appId)
  if (!app) return { error: 'App not found.' }

  const existing = await getVerdict(appId)
  if (existing?.editedByHuman) {
    return { error: 'This verdict was edited by hand. Clear that edit before redrafting.' }
  }

  const input = await getVerdictInput(appId)
  if (!input) return { error: 'App not found.' }
  if (!input.description && !input.tagline) {
    // The model would be guessing from a name alone, and it would sound just as
    // confident doing it.
    return { error: 'This app has no tagline or description for the model to read.' }
  }

  let draft
  try {
    draft = await draftVerdict(input, { signal: AbortSignal.timeout(60_000) })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'The model call failed.' }
  }

  await saveVerdict({ appId, draft, model: DEFAULT_MODEL })

  await logAdminAction(admin, {
    action: 'draft_verdict',
    summary: `${existing ? 'Redrafted' : 'Drafted'} vibecode verdict for ${app.name}: ${verdictLabel[draft.verdict]}`,
    targetType: 'app',
    targetId: appId,
    detail: { verdict: draft.verdict, headline: draft.headline, model: DEFAULT_MODEL },
  })

  revalidatePublic(app.slug)
  revalidateAdmin()

  return { ok: `${verdictLabel[draft.verdict]} — “${draft.headline}”` }
}

/* -------------------------------------------------------------------------- */
/*                                    Users                                    */
/* -------------------------------------------------------------------------- */

/**
 * Promotes a founder to admin, or demotes one back.
 *
 * Two things it refuses, both of which would lock somebody out of a door they
 * are standing in front of:
 *
 * An admin cannot change their own role. Demoting yourself is a click away from
 * losing the screen you did it on, and there is no way back through the UI —
 * `npm run role` exists for exactly that, where a second person is not needed.
 *
 * The last admin cannot be demoted. It is the same failure as the first, one
 * step removed: the site would be left with nobody who can reach these screens,
 * and the only cure would be database access.
 *
 * Admin is not a paid tier or a badge — it is the right to change other
 * people's listings and read the books — so every grant is logged with a
 * required reason.
 */
export async function setUserRoleAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await actor()

  const profileId = String(formData.get('profileId') ?? '')
  const role = String(formData.get('role') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (role !== 'admin' && role !== 'founder') return { error: 'Unknown role.' }
  if (!note) return { error: 'A reason is required.' }

  if (profileId === admin.id) {
    return { error: 'You cannot change your own role. Use npm run role for that.' }
  }

  const [target] = await db
    .select({ handle: profiles.handle, role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1)

  if (!target) return { error: 'User not found.' }
  if (target.role === role) return { error: `@${target.handle} is already ${role}.` }

  if (role === 'founder' && (await countAdmins()) <= 1) {
    return { error: 'This is the only admin. Promote someone else before demoting them.' }
  }

  await db.update(profiles).set({ role }).where(eq(profiles.id, profileId))

  await logAdminAction(admin, {
    action: 'set_role',
    summary: `${role === 'admin' ? 'Promoted' : 'Demoted'} @${target.handle} to ${role}`,
    targetType: 'profile',
    targetId: profileId,
    detail: { from: target.role, to: role, note },
  })

  revalidateAdmin()

  return { ok: `@${target.handle} is now ${role}.` }
}
