'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { apps } from '@/db/schema'
import { profiles, purchases } from '@/db/schema'
import { setCancelAtPeriodEnd, setPurchaseHidden } from '@/lib/data/purchases'
import { requireUser } from '@/lib/auth'
import { setSubscriptionCancellation } from '@/lib/checkout'

export type ProfileState = {
  error?: string
  fieldErrors?: Record<string, string>
  saved?: boolean
}

const profileSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Handle must be at least 3 characters.')
    .max(24, 'Handle must be 24 characters or fewer.')
    .regex(/^[a-z0-9]+$/, 'Handle can only contain lowercase letters and numbers.'),
  name: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(280, 'Bio must be 280 characters or fewer.').optional(),
  website: z
    .union([z.string().trim().url('Website must be a full URL.'), z.literal('')])
    .optional(),
  // Stored bare, so every page can render it as @handle or build a URL from it.
  twitter: z
    .string()
    .trim()
    .transform((value) =>
      value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, ''),
    )
    .pipe(
      z.union([
        z.string().regex(/^[A-Za-z0-9_]{1,15}$/, 'That is not a valid X handle.'),
        z.literal(''),
      ]),
    )
    .optional(),
})

export async function updateProfileAction(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser('/account')

  const parsed = profileSchema.safeParse({
    handle: formData.get('handle'),
    name: formData.get('name'),
    bio: formData.get('bio'),
    website: formData.get('website'),
    twitter: formData.get('twitter'),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { error: 'Check the highlighted fields.', fieldErrors }
  }

  const data = parsed.data

  /*
   * Checked before writing so the founder gets a message against the field
   * rather than a unique-violation stack trace. The index still enforces it —
   * two people renaming to the same handle at once would race past this — but
   * losing that race is rare and losing it loudly is worse than losing it here.
   */
  if (data.handle !== user.profile.handle) {
    const [taken] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.handle, data.handle), ne(profiles.id, user.id)))
      .limit(1)

    if (taken) return { fieldErrors: { handle: 'That handle is already taken.' } }
  }

  await db
    .update(profiles)
    .set({
      handle: data.handle,
      name: data.name || null,
      bio: data.bio || null,
      website: data.website || null,
      twitter: data.twitter || null,
      /*
       * The follower count belongs to the handle that was signed in with, not
       * to whatever is typed here. Clearing it keeps the site from attributing
       * one account's audience to another; it comes back at the next X sign-in.
       */
      twitterFollowers: data.twitter === user.profile.twitter ? undefined : null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id))

  revalidatePath('/account')
  // The public profile lives at the handle, so a rename leaves the old path
  // serving a page that no longer exists.
  revalidatePath(`/founders/${user.profile.handle}`)
  revalidatePath(`/founders/${data.handle}`)

  return { saved: true }
}

export type BillingActionState = {
  error?: string
  /**
   * Set on success so the client knows the write landed and can ask the server
   * for the row again. An empty object cannot say that — it is also what the
   * state starts as, before anything has been clicked.
   */
  ok?: boolean
}

/**
 * Turns one sponsor subscription's auto-renew off, or back on.
 *
 * The row is looked up by id *and* owner, so the form supplies nothing that
 * decides whose subscription is changed. Neither direction touches `status`:
 * Paddle keeps billing until the period closes, and the `subscription.canceled`
 * webhook is what withdraws the slot when it does.
 *
 * The local flag is written here rather than left to `subscription.canceled`,
 * because the founder has just clicked and the screen has to answer them. The
 * webhook writes the same value, so an intent set in Paddle's own portal still
 * arrives, and the two agreeing is not a conflict.
 */
export async function setSponsorCancellationAction(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const user = await requireUser('/account')

  // The column is a uuid, so anything else is a database error rather than a
  // miss. Rejected here so a mangled form field reads as "not found".
  const purchaseId = String(formData.get('purchaseId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) return { error: 'That subscription is not active.' }

  const cancel = formData.get('cancel') === 'true'

  const [row] = await db
    .select({ subscriptionId: purchases.subscriptionId, status: purchases.status })
    .from(purchases)
    .where(and(eq(purchases.id, purchaseId), eq(purchases.profileId, user.id)))
    .limit(1)

  if (!row?.subscriptionId || row.status !== 'active') {
    return { error: 'That subscription is not active.' }
  }

  const result = await setSubscriptionCancellation(row.subscriptionId, cancel)
  if (result.error) return { error: result.error }

  await setCancelAtPeriodEnd(row.subscriptionId, cancel)

  revalidatePath('/account')
  return { ok: true }
}

/**
 * Shows or hides an active sponsor slot, without ending it.
 *
 * Offered on gifted rows as well as paid ones: the reason to leave the rails
 * for a week is about the app rather than about who paid for it.
 *
 * Restricted to `active` sponsor rows. A revoked or pending purchase entitles
 * nothing, and a dofollow link is a one-time purchase of an attribute on one
 * link, with nothing worth switching. Checked here and not only in the UI,
 * because a form post is not a permission.
 */
export async function setPurchaseVisibilityAction(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const user = await requireUser('/account')

  const purchaseId = String(formData.get('purchaseId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) {
    return { error: 'That purchase is not an active sponsor slot.' }
  }

  const hidden = formData.get('hidden') === 'true'

  // Ownership and status are checked together, so neither the id nor the state
  // it is in comes from the form.
  const [row] = await db
    .select({ status: purchases.status, kind: purchases.kind, appId: purchases.appId })
    .from(purchases)
    .where(and(eq(purchases.id, purchaseId), eq(purchases.profileId, user.id)))
    .limit(1)

  if (!row || row.status !== 'active' || row.kind !== 'sponsor') {
    return { error: 'That purchase is not an active sponsor slot.' }
  }

  const updated = await setPurchaseHidden(purchaseId, hidden)
  if (!updated) return { error: 'That purchase is not an active sponsor slot.' }

  const [app] = await db
    .select({ slug: apps.slug })
    .from(apps)
    .where(eq(apps.id, row.appId))
    .limit(1)

  revalidatePath('/account')
  // The rails are on every page that renders them, and the app page carries
  // the link whose rel attribute has just changed.
  revalidatePath('/', 'layout')
  if (app) revalidatePath(`/apps/${app.slug}`)

  return {}
}
