'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { apps, categories } from '@/db/schema'
import { AppStoreLookupError, lookupApp, parseAppStoreId } from '@/lib/appstore/lookup'
import { getCurrentUser } from '@/lib/auth'
import { saveAppStoreMetadata, setAppTechStack, uniqueSlug } from '@/lib/data/mutations'

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

/** Step one: turn a pasted App Store link into a pre-filled listing. */
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
    .select({ slug: apps.slug })
    .from(apps)
    .where(eq(apps.appStoreId, appStoreId))
    .limit(1)

  if (existing) {
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
  name: z.string().trim().min(1, 'Name is required.').max(80),
  tagline: z.string().trim().max(110).optional(),
  description: z.string().trim().max(2000).optional(),
  categorySlug: z.string().trim().min(1, 'Pick a category.'),
  website: z
    .union([z.string().trim().url('Website must be a full URL.'), z.literal('')])
    .optional(),
  tech: z.array(z.string()).default([]),
})

export type SubmitState = {
  error?: string
  fieldErrors?: Record<string, string>
  /** Set when the draft is valid but nobody is signed in to own it. */
  needsAuth?: { appStoreId: string }
}

/** Step two: create the listing as a draft. It goes live once revenue verifies. */
export async function createAppAction(
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

  const [duplicate] = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.appStoreId, data.appStoreId))
    .limit(1)

  if (duplicate) return { error: 'That app has already been submitted.' }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, data.categorySlug))
    .limit(1)

  const store = await lookupApp(data.appStoreId).catch(() => null)

  const [created] = await db
    .insert(apps)
    .values({
      slug: await uniqueSlug(data.name),
      name: data.name,
      tagline: data.tagline || null,
      description: data.description || null,
      appStoreId: data.appStoreId,
      bundleId: store?.bundleId ?? null,
      appStoreUrl: store?.appStoreUrl ?? `https://apps.apple.com/app/id${data.appStoreId}`,
      founderId: user.id,
      categoryId: category?.id ?? null,
      website: data.website || store?.website || null,
      launchedAt: store?.releasedAt?.toISOString().slice(0, 10) ?? null,
      // Draft until a provider connection verifies revenue. Nothing reaches the
      // public index on the strength of a form submission alone.
      status: 'draft',
    })
    .returning({ id: apps.id })

  if (store) await saveAppStoreMetadata(created.id, store)
  await setAppTechStack(created.id, data.tech)

  revalidatePath('/dashboard')
  redirect(`/dashboard/${created.id}/connect`)
}
