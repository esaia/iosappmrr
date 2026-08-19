'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { requireUser } from '@/lib/auth'
import {
  deleteApp,
  getOwnedApp,
  setAppTechStack,
  slugForAnonymity,
  updateAppDetails,
} from '@/lib/data/mutations'

export type EditState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean }

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  tagline: z.string().trim().max(110),
  description: z.string().trim().max(2000),
  categorySlug: z.string().trim().min(1, 'Pick a category.'),
  website: z.union([z.string().trim().url('Website must be a full URL.'), z.literal('')]),
})

export async function updateAppAction(
  _previous: EditState,
  formData: FormData,
): Promise<EditState> {
  const user = await requireUser('/dashboard')

  const appId = String(formData.get('appId') ?? '')
  // Ownership is checked here, not in the UI — a form post is not a permission.
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  const parsed = schema.safeParse({
    name: formData.get('name') ?? '',
    tagline: formData.get('tagline') ?? '',
    description: formData.get('description') ?? '',
    categorySlug: formData.get('categorySlug') ?? '',
    website: formData.get('website') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message
    return { error: 'Check the highlighted fields.', fieldErrors }
  }

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, parsed.data.categorySlug))
    .limit(1)

  const anonymous = formData.get('anonymous') === 'on'
  /*
   * Turning anonymity on has to move the URL as well: /apps/ledgerly names the
   * app the rest of the page has just stopped naming. Turning it off gives the
   * name back. Any link to the old slug 404s, which is the price of the switch
   * and is why the form says so.
   */
  const rotated = await slugForAnonymity(app.slug, parsed.data.name, anonymous)

  await updateAppDetails(appId, {
    name: parsed.data.name,
    tagline: parsed.data.tagline || null,
    description: parsed.data.description || null,
    categoryId: category?.id ?? null,
    website: parsed.data.website || null,
    isAnonymous: anonymous,
    ...(rotated ? { slug: rotated } : {}),
    /*
     * `websiteDofollow` is deliberately not read from this form. It is granted
     * only by the Polar webhook once an order is paid — accepting it here
     * would let anyone POST the field and take the paid link for free.
     */
  })

  await setAppTechStack(appId, formData.getAll('tech').map(String))

  revalidatePath(`/apps/${app.slug}`)
  if (rotated) revalidatePath(`/apps/${rotated}`)
  revalidatePath('/dashboard')
  return { saved: true }
}

export type DeleteState = { error?: string }

/**
 * Permanent. The form requires the app's name typed back, so a stray click on
 * a page full of save buttons cannot destroy a listing and its history.
 */
export async function deleteAppAction(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const user = await requireUser('/dashboard')

  const appId = String(formData.get('appId') ?? '')
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  const typed = String(formData.get('confirmName') ?? '').trim()
  if (typed !== app.name) {
    return { error: `Type the app's name exactly — ${app.name} — to confirm.` }
  }

  await deleteApp(appId)

  revalidatePath('/dashboard')
  revalidatePath(`/apps/${app.slug}`)
  redirect('/dashboard')
}

export async function listCategoryOptions() {
  return db
    .select({ slug: categories.slug, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder))
}
