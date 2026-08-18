import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  appStoreMetadata,
  apps,
  appTechStack,
  categories,
  techStackTags,
  vibecodeVerdicts,
} from '@/db/schema'
import { PROMPT_VERSION, type VibecodeDraft, type VibecodeInput } from '@/lib/vibecode'

/** The cached verdict for one app, or null when none has been drafted. */
export async function getVerdict(appId: string) {
  const [row] = await db
    .select()
    .from(vibecodeVerdicts)
    .where(eq(vibecodeVerdicts.appId, appId))
    .limit(1)

  return row ?? null
}

/**
 * Everything the model is allowed to see about an app.
 *
 * Written as an explicit projection rather than passing a row through, so
 * adding a revenue column to `apps` cannot silently start feeding earnings
 * into the prompt.
 */
export async function getVerdictInput(appId: string): Promise<VibecodeInput | null> {
  const [row] = await db
    .select({
      name: apps.name,
      tagline: apps.tagline,
      description: apps.description,
      category: categories.name,
      hasInAppPurchases: appStoreMetadata.hasInAppPurchases,
      releasedAt: appStoreMetadata.releasedAt,
    })
    .from(apps)
    .leftJoin(categories, eq(categories.id, apps.categoryId))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(eq(apps.id, appId))
    .limit(1)

  if (!row) return null

  const tech = await db
    .select({ name: techStackTags.name })
    .from(appTechStack)
    .innerJoin(techStackTags, eq(techStackTags.id, appTechStack.tagId))
    .where(eq(appTechStack.appId, appId))

  return {
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    tech: tech.map((t) => t.name),
    hasInAppPurchases: row.hasInAppPurchases,
    releasedAt: row.releasedAt?.toISOString().slice(0, 10) ?? null,
  }
}

/**
 * Stores a freshly drafted verdict, replacing any previous one.
 *
 * Overwrites `edited_by_human` back to false: this row is now the model's
 * words again, and leaving the flag set would make a backfill skip a row no
 * human has actually reviewed.
 */
export async function saveVerdict(input: { appId: string; draft: VibecodeDraft; model: string }) {
  await db
    .insert(vibecodeVerdicts)
    .values({
      appId: input.appId,
      ...input.draft,
      model: input.model,
      promptVersion: PROMPT_VERSION,
    })
    .onConflictDoUpdate({
      target: vibecodeVerdicts.appId,
      set: {
        ...input.draft,
        model: input.model,
        promptVersion: PROMPT_VERSION,
        editedByHuman: false,
        updatedAt: new Date(),
      },
    })
}
