/**
 * Every table a backup covers, in the order a restore has to replay them.
 *
 * The order is by foreign key: a row can only be inserted once the rows it
 * points at exist, so `profiles` and the taxonomy tables come before `apps`,
 * and everything that hangs off an app comes after it. Restoring in this order
 * means never having to defer constraints.
 *
 * Kept as a hand-written list rather than derived from the schema because
 * nothing in the schema records that order. `backup-tables.test.ts` fails if a
 * table is added to `src/db/schema.ts` and not to this list, so the omission is
 * caught by the test suite rather than by a restore that is missing a table.
 *
 * Deliberately absent: Supabase's own `auth.users`. It is not ours to read —
 * the service role can, but this project's connection is a plain Postgres user,
 * and a dump of it would be a dump of everyone's login. See the restore script
 * for what that means when rebuilding from nothing.
 */
export const BACKUP_TABLES = [
  'profiles',
  'categories',
  'tech_stack_tags',
  'apps',
  'app_tech_stack',
  'app_store_metadata',
  'app_store_reviews',
  'revenue_connections',
  'revenue_snapshots',
  'app_metrics',
  'follows',
  'app_views',
  'purchases',
  'vibecode_verdicts',
  'site_settings',
  'admin_actions',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/** Identifies the file for the restore script, which refuses anything else. */
export const BACKUP_FORMAT = 'trustmrr-backup'

/**
 * Bumped only when the shape around the rows changes — the table list moving is
 * not a format change, since a restore reads the names out of the file.
 */
export const BACKUP_VERSION = 1

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  generatedAt: string
  tables: { name: string; rows: Record<string, unknown>[] }[]
}

/** `trustmrr-backup-2026-08-19-1432.json` — sorts chronologically in a folder. */
export function backupFilename(now = new Date()) {
  const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  return `${BACKUP_FORMAT}-${stamp}.json`
}
