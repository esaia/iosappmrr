import 'server-only'
import { sql } from 'drizzle-orm'
import { client, db } from '@/db'
import { BACKUP_FORMAT, BACKUP_TABLES, BACKUP_VERSION, type BackupTable } from './backup-tables'

/**
 * A full copy of the application database, as a JSON file the admin downloads.
 *
 * Supabase only keeps automated backups on its paid plans, so on the free tier
 * the entire site is one dropped table away from being gone. This is the
 * stand-in: it is taken by hand, it lands on a laptop rather than in a managed
 * store, and `scripts/restore-backup.ts` puts it back. It is not point-in-time
 * recovery and does not pretend to be — it is the difference between losing
 * everything and losing whatever happened since the last download.
 *
 * Rows are serialised by Postgres itself, via `row_to_json`, rather than by
 * reading them into JavaScript and stringifying. That is what makes the file
 * restorable: `json_populate_recordset` on the way back in is the exact inverse,
 * so bytea, timestamptz, jsonb, enums, and bigints all survive the round trip
 * without this module having to know a single column type. Serialising in
 * JavaScript would silently turn the encrypted credentials into `{"0":137,…}`
 * and every bigint into a lossy double.
 */

/** Rows pulled from the cursor per round trip. */
const CHUNK = 500

export type BackupCounts = Record<BackupTable, number>

/**
 * How many rows each table holds, in one statement.
 *
 * Sixteen counts is sixteen round trips if written the obvious way, and this
 * database is on the other side of the world — see the note on
 * `getAdminOverview`. Postgres does all of them in one pass.
 *
 * The table names are interpolated raw because they come from a literal list in
 * this repository, not from anything a request can influence.
 */
export async function getBackupCounts(): Promise<BackupCounts> {
  const columns = BACKUP_TABLES.map((table) =>
    sql.raw(`(select count(*) from "${table}")::int as "${table}"`),
  )

  const rows = await db.execute<BackupCounts>(sql`select ${sql.join(columns, sql.raw(', '))}`)
  return rows[0]
}

export type BackupResult = { rows: number; bytes: number }

/**
 * Streams the whole database out as one JSON document.
 *
 * Written to the stream table by table and row by row, never assembled in
 * memory: a serverless function has a fixed heap, and the point at which a
 * backup would start failing is exactly the point at which the data has become
 * worth backing up. The cursor keeps the same bound on the database side.
 *
 * The read runs inside one repeatable-read transaction, so every table is a
 * view of the same instant. Without it a purchase written between the `apps`
 * and `purchases` reads would restore as a purchase for an app that does not
 * exist, and the restore would fail on the foreign key.
 */
export function streamBackup({
  onDone,
  onError,
}: {
  onDone?: (result: BackupResult) => void | Promise<void>
  onError?: (error: unknown) => void
} = {}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let rows = 0
  let bytes = 0

  /*
   * Backpressure. `pull` is only called once `start` has returned, so the work
   * is kicked off unawaited and parks itself here whenever the consumer is
   * behind — awaiting it inside `start` instead would queue the entire dump in
   * memory, which is the thing this function exists to avoid.
   */
  let resume: (() => void) | null = null

  async function run(controller: ReadableStreamDefaultController<Uint8Array>) {
    const write = async (text: string) => {
      const chunk = encoder.encode(text)
      bytes += chunk.byteLength
      controller.enqueue(chunk)
      if ((controller.desiredSize ?? 1) <= 0) {
        await new Promise<void>((resolve) => {
          resume = resolve
        })
      }
    }

    try {
      await write(
        `{"format":${JSON.stringify(BACKUP_FORMAT)},` +
          `"version":${BACKUP_VERSION},` +
          `"generatedAt":${JSON.stringify(new Date().toISOString())},` +
          `"tables":[`,
      )

      await client.begin('isolation level repeatable read read only', async (tx) => {
        /*
         * Without this, `growth_30d` comes back from a restore off by one
         * float bit. The driver opens every connection with
         * `extra_float_digits = 0`, which rounds float4 output to six
         * significant digits — enough for display, not enough to reconstruct
         * the value that was stored. Anything above zero means "as many digits
         * as it takes to round-trip exactly", which is what a backup needs.
         * `local` keeps it to this transaction, since the connection is pooled.
         */
        await tx`set local extra_float_digits = 3`

        let firstTable = true

        for (const table of BACKUP_TABLES) {
          await write(`${firstTable ? '' : ','}\n{"name":${JSON.stringify(table)},"rows":[`)
          firstTable = false

          let firstRow = true
          // `tx(table)` quotes the name as an identifier rather than a value.
          await tx<{ row: unknown }[]>`
            select row_to_json(t) as row from ${tx(table)} t
          `.cursor(CHUNK, async (batch) => {
            for (const record of batch) {
              await write(`${firstRow ? '' : ','}${JSON.stringify(record.row)}`)
              firstRow = false
              rows += 1
            }
          })

          await write(']}')
        }
      })

      await write('\n]}\n')
      controller.close()
      await onDone?.({ rows, bytes })
    } catch (error) {
      /*
       * A stream that has already sent bytes cannot retract them, so a failure
       * halfway through arrives at the browser as a truncated download rather
       * than an error page. Erroring the stream is what makes it truncated
       * *and* invalid JSON, which is the only honest signal left: a restore
       * will refuse to parse it instead of quietly replaying half a database.
       */
      console.error('[backup] dump failed', error)
      controller.error(error)
      onError?.(error)
    }
  }

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        void run(controller)
      },
      pull() {
        resume?.()
        resume = null
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 1024 }),
  )
}
