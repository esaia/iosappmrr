import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { siteSettings } from '@/db/schema'
import { DEFAULT_SPONSOR_SLOTS } from '@/lib/ads'

/**
 * Settings an admin can change at runtime.
 *
 * Each entry names its own default, so the table starting empty is a valid
 * configuration rather than an outage. A key that is missing, malformed, or
 * left over from a removed feature falls back to that default instead of
 * throwing — a settings row is not worth taking the site down for.
 */
const DEFAULTS = {
  /**
   * How many sponsor slots exist to sell. Raising this puts more spots on sale
   * immediately; lowering it does not evict anyone already booked, it just
   * stops new checkouts once the count is reached.
   */
  sponsor_slots: DEFAULT_SPONSOR_SLOTS,
} as const

export type SettingKey = keyof typeof DEFAULTS

/** Bounds for the settings that are plain numbers, enforced on write. */
export const SETTING_LIMITS: Record<SettingKey, { min: number; max: number }> = {
  // Zero is allowed — it is how you take the rails off sale without a deploy.
  // The ceiling is arbitrary but deliberate: a typo of 600 would otherwise
  // advertise inventory that cannot exist.
  sponsor_slots: { min: 0, max: 50 },
}

/**
 * Applies a setting's default and bounds to a raw value.
 *
 * Exported because some callers read these rows as part of a larger statement
 * rather than through `getSetting` — the database is far enough away that an
 * extra round trip is worth avoiding, and this keeps the fallback and clamping
 * identical wherever the raw value came from.
 *
 * Clamping happens on read as well as write: a value stored before a limit
 * changed, or edited straight in the database, must not escape the bounds the
 * rest of the code assumes.
 */
export function clampSetting<K extends SettingKey>(key: K, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULTS[key]
  const { min, max } = SETTING_LIMITS[key]
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Convenience wrapper for the only numeric setting that exists so far. */
export function clampSlots(value: unknown) {
  return clampSetting('sponsor_slots', value)
}

/**
 * Reads one setting, falling back to its default.
 *
 * Not request-cached: an admin changing a value and reloading has to see the
 * new number, and these reads are a single indexed row.
 */
export async function getSetting<K extends SettingKey>(key: K): Promise<number> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1)

  return clampSetting(key, row?.value)
}

/** How many sponsor rail slots are on sale right now. */
export function getSponsorSlots() {
  return getSetting('sponsor_slots')
}

/**
 * Writes a setting. Callers are admin-only server actions — nothing validates
 * the caller here, so do not export a path to this that a founder can reach.
 */
export async function setSetting(key: SettingKey, value: number, updatedBy: string) {
  const clamped = clampSetting(key, value)

  await db
    .insert(siteSettings)
    .values({ key, value: clamped, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: clamped, updatedBy, updatedAt: new Date() },
    })

  return clamped
}
