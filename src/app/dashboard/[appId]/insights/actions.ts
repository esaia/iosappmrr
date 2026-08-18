'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { getOwnedApp, updateAppInsights } from '@/lib/data/mutations'

export type InsightsState = { error?: string; saved?: boolean }

/** Trims, then turns an empty field into null rather than an empty string. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))

/** Comma-separated input, de-duplicated, capped so a paste cannot flood the row. */
function parseList(raw: string, max = 12) {
  return [
    ...new Set(
      raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].slice(0, max)
}

const schema = z.object({
  valueProposition: optionalText(280),
  problemSolved: optionalText(280),
  audience: optionalText(200),
  audienceType: z.enum(['B2C', 'B2B', 'B2B2C']).nullable().catch(null),
  additionalInfo: optionalText(400),
})

export async function saveInsightsAction(
  _previous: InsightsState,
  formData: FormData,
): Promise<InsightsState> {
  const user = await requireUser('/dashboard')

  const appId = String(formData.get('appId') ?? '')
  // Ownership is checked here, not in the UI — a form post is not a permission.
  const app = await getOwnedApp(appId, user.id)
  if (!app) return { error: 'App not found.' }

  const rawType = String(formData.get('audienceType') ?? '')
  const parsed = schema.safeParse({
    valueProposition: formData.get('valueProposition') ?? '',
    problemSolved: formData.get('problemSolved') ?? '',
    audience: formData.get('audience') ?? '',
    audienceType: rawType === '' ? null : rawType,
    additionalInfo: formData.get('additionalInfo') ?? '',
  })

  if (!parsed.success) return { error: 'Some fields are too long. Trim them and try again.' }

  await updateAppInsights(appId, {
    ...parsed.data,
    marketTags: parseList(String(formData.get('marketTags') ?? '')),
    marketingChannels: parseList(String(formData.get('marketingChannels') ?? '')),
  })

  revalidatePath(`/apps/${app.slug}`)
  revalidatePath(`/dashboard/${appId}/insights`)
  return { saved: true }
}
