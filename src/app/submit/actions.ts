'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { apps, categories } from '@/db/schema'
import { ANONYMOUS_NAME } from '@/lib/anonymous'
import { AppStoreLookupError, lookupApp, parseAppStoreId } from '@/lib/appstore/lookup'
import { getCurrentUser } from '@/lib/auth'
import { createCheckout } from '@/lib/checkout'
import { connectProvider } from '@/lib/data/connections'
import {
  saveAppStoreMetadata,
  setAppTechStack,
  slugForAnonymity,
  uniqueSlug,
} from '@/lib/data/mutations'
import { isPaddleConfigured } from '@/lib/paddle'
import { isConnectable } from '@/lib/providers'
import { PROVIDER_FIELDS } from '@/lib/provider-fields'
import { LISTING_LIMITS, tooLong } from '@/lib/listing'

export type LookupState = {
  error?: string
  app?: {
    appStoreId: string
    name: string
    tagline: string
    description: string
    iconUrl: string | null
    sellerName: string | null
    primaryGenre: string | null
    bundleId: string | null
    appStoreUrl: string | null
    website: string | null
    releasedAt: string | null
  }
}

/** Turns a pasted App Store link into a pre-filled listing. */
export async function lookupAppAction(
  _previous: LookupState,
  formData: FormData,
): Promise<LookupState> {
  // No auth check: this only reads Apple's public catalogue and reports whether
  // the app is already listed. Nothing is written.
  const input = String(formData.get('appStoreUrl') ?? '')
  const appStoreId = parseAppStoreId(input)

  if (!appStoreId) {
    return {
      error:
        'That does not look like an App Store link. Paste the URL from the app’s App Store page, or its numeric ID.',
    }
  }

  const [existing] = await db
    .select({ slug: apps.slug, status: apps.status })
    .from(apps)
    .where(eq(apps.appStoreId, appStoreId))
    .limit(1)

  /*
   * Only a live listing blocks the lookup. An unverified draft is invisible to
   * everyone but its owner, so treating it as taken would stop a founder in
   * their tracks over a listing they cannot see — and would let anyone reserve
   * an app by submitting it and never verifying. Collisions are resolved at
   * save time instead, where we know who is asking.
   */
  if (existing?.status === 'live') {
    return { error: `That app is already listed at /apps/${existing.slug}.` }
  }

  try {
    const found = await lookupApp(appStoreId)
    if (!found) {
      return { error: 'The App Store has no app with that ID in the US store.' }
    }

    return {
      app: {
        appStoreId: found.appStoreId,
        name: found.name,
        // Apple's description is a wall of marketing; the first line is usually
        // the closest thing to a tagline, and the founder edits it anyway.
        tagline: (found.description?.split('\n')[0] ?? '').slice(0, 110),
        description: found.description?.slice(0, 1500) ?? '',
        iconUrl: found.iconUrl,
        sellerName: found.sellerName,
        primaryGenre: found.primaryGenre,
        bundleId: found.bundleId,
        appStoreUrl: found.appStoreUrl,
        website: found.website,
        releasedAt: found.releasedAt?.toISOString().slice(0, 10) ?? null,
      },
    }
  } catch (error) {
    if (error instanceof AppStoreLookupError) return { error: error.message }
    throw error
  }
}

const submitSchema = z.object({
  appStoreId: z.string().regex(/^\d{6,12}$/),
  name: z.string().trim().min(1, 'Name is required.').max(80, 'Names are capped at 80 characters.'),
  tagline: z
    .string()
    .trim()
    .max(LISTING_LIMITS.tagline, tooLong('Taglines', LISTING_LIMITS.tagline))
    .optional(),
  description: z
    .string()
    .trim()
    .max(LISTING_LIMITS.description, tooLong('Descriptions', LISTING_LIMITS.description))
    .optional(),
  categorySlug: z.string().trim().min(1, 'Pick a category.'),
  website: z
    .union([z.string().trim().url('Website must be a full URL.'), z.literal('')])
    .optional(),
  tech: z.array(z.string()).default([]),
  provider: z.string().refine(isConnectable, 'Choose a provider to verify revenue with.'),
  dofollow: z.boolean().default(false),
  anonymous: z.boolean().default(false),
})

export type SubmitState = {
  error?: string
  fieldErrors?: Record<string, string>
  /** Set when the draft is valid but nobody is signed in to own it. */
  needsAuth?: { appStoreId: string }
}

/**
 * Lists an app and verifies its revenue in one submission.
 *
 * These used to be two screens, and the second one was where founders dropped
 * out: a draft nobody could see, parked behind a step they had to come back
 * for. Doing both here means an app is either live or was never created in a
 * state worth keeping — the listing is written first only because a provider
 * connection needs an app to hang off.
 *
 * A failed connection therefore leaves a draft behind on purpose. Re-submitting
 * finds it below and reuses it, so retrying with a corrected key does not
 * create a second listing, and the founder can also finish later from
 * /dashboard/[appId]/connect.
 */
export async function submitAppAction(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await getCurrentUser()

  const parsed = submitSchema.safeParse({
    appStoreId: formData.get('appStoreId'),
    name: formData.get('name'),
    tagline: formData.get('tagline'),
    description: formData.get('description'),
    categorySlug: formData.get('categorySlug'),
    website: formData.get('website'),
    tech: formData.getAll('tech').map(String),
    provider: formData.get('provider'),
    dofollow: formData.get('dofollow') === 'on',
    anonymous: formData.get('anonymous') === 'on',
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
   * A listing needs an owner: `apps.founder_id` is NOT NULL and the RLS insert
   * policy requires it to equal the signed-in user. Rather than redirect and
   * throw the draft away, hand the form back so it can offer sign-in with a
   * return path that restores this app.
   */
  if (!user) return { needsAuth: { appStoreId: data.appStoreId } }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, data.categorySlug))
    .limit(1)

  const [duplicate] = await db
    .select({ id: apps.id, slug: apps.slug, status: apps.status, founderId: apps.founderId })
    .from(apps)
    .where(eq(apps.appStoreId, data.appStoreId))
    .limit(1)

  if (duplicate && duplicate.status === 'live') {
    // Live listings are settled; nobody re-submits them.
    return { error: `That app is already listed at /apps/${duplicate.slug}.` }
  }

  if (duplicate && duplicate.founderId !== user.id) {
    return {
      error:
        'Another founder has claimed this app and is verifying it. If it is yours, get in touch and we will sort it out.',
    }
  }

  const store = await lookupApp(data.appStoreId).catch(() => null)

  let app: { id: string; slug: string }

  if (duplicate) {
    /*
     * A draft of this founder's own, from an earlier attempt that failed to
     * verify. Take the fields as they now stand — they may have fixed the very
     * thing that was wrong — but keep the slug, because it is what any link
     * they have already shared points at.
     */
    const rotated = await slugForAnonymity(duplicate.slug, data.name, data.anonymous)

    const [updated] = await db
      .update(apps)
      .set({
        name: data.name,
        tagline: data.tagline || null,
        description: data.description || null,
        categoryId: category?.id ?? null,
        website: data.website || store?.website || null,
        isAnonymous: data.anonymous,
        /*
         * Normally the slug is kept, because it is what any link they have
         * already shared points at. The exception is a retry that flips
         * anonymity: the old slug spells the name the listing is now hiding,
         * and nothing has been shared yet — the app never went live.
         */
        ...(rotated ? { slug: rotated } : {}),
      })
      .where(eq(apps.id, duplicate.id))
      .returning({ id: apps.id, slug: apps.slug })
    app = updated
  } else {
    const [created] = await db
      .insert(apps)
      .values({
        /*
         * A stealth listing cannot carry a slug spelling the name it is
         * hiding — /apps/ledgerly gives it away before the page renders.
         * `uniqueSlug` numbers the duplicates, so every one of them is
         * stealth-company-2, -3, and so on.
         */
        slug: await uniqueSlug(data.anonymous ? ANONYMOUS_NAME : data.name),
        name: data.name,
        tagline: data.tagline || null,
        description: data.description || null,
        appStoreId: data.appStoreId,
        bundleId: store?.bundleId ?? null,
        appStoreUrl: store?.appStoreUrl ?? `https://apps.apple.com/app/id${data.appStoreId}`,
        founderId: user.id,
        categoryId: category?.id ?? null,
        website: data.website || store?.website || null,
        isAnonymous: data.anonymous,
        launchedAt: store?.releasedAt?.toISOString().slice(0, 10) ?? null,
        // Draft until the connection below verifies revenue. Nothing reaches
        // the public index on the strength of a form submission alone.
        status: 'draft',
      })
      .returning({ id: apps.id, slug: apps.slug })
    app = created
  }

  if (store) await saveAppStoreMetadata(app.id, store)
  await setAppTechStack(app.id, data.tech)

  /*
   * Only the fields the chosen provider declares are passed on. Reading every
   * remaining form entry would send the app's own name and description to the
   * adapter as if they were credentials.
   */
  const credentials = Object.fromEntries(
    (PROVIDER_FIELDS[data.provider] ?? []).map((field) => [
      field.name,
      String(formData.get(field.name) ?? ''),
    ]),
  )

  const connected = await connectProvider({
    appId: app.id,
    founderId: user.id,
    provider: data.provider,
    credentials,
  })

  revalidatePath('/dashboard')

  if (!connected.ok) {
    /*
     * When the failure belongs to a field, the summary is deliberately generic.
     * `connectProvider` reports the same sentence both ways, and printing it
     * verbatim under the input and again in the banner reads as two separate
     * problems with one key.
     */
    const fieldErrors = connected.fieldErrors
    return {
      error: fieldErrors ? 'Check the highlighted fields.' : connected.error,
      fieldErrors,
    }
  }

  revalidatePath(`/apps/${app.slug}`)

  /*
   * The upgrade is charged only once the app is real and verified. A founder
   * whose key was wrong has not been billed for a link on a listing that never
   * went live, and one who reaches Paddle is buying something that already
   * exists. If the checkout cannot be opened we still send them to the app they
   * just published — the sale can be made again from the edit screen, but the
   * listing is not something to hand back as an error.
   */
  if (data.dofollow && isPaddleConfigured('dofollow')) {
    const checkout = await createCheckout('dofollow', app, user)
    if ('url' in checkout) redirect(checkout.url)
  }

  redirect(`/apps/${app.slug}`)
}
