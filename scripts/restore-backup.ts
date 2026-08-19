import './load-env'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { BACKUP_FORMAT, BACKUP_TABLES, type BackupFile } from '../src/lib/data/backup-tables'

/**
 * Puts a downloaded backup back into a database.
 *
 * The exact inverse of `src/lib/data/backup.ts`: that file asked Postgres to
 * turn rows into JSON with `row_to_json`, and this one hands the same JSON back
 * to `json_populate_recordset`, which turns it into rows of the table's own
 * types. Neither side has to know that `encrypted_credentials` is a bytea or
 * that `mrr_cents` is a bigint, and neither can get it wrong.
 *
 *   npm run db:restore -- ~/Downloads/trustmrr-backup-2026-08-19-1432.json
 *   npm run db:restore -- backup.json --replace     # wipe what is there first
 *
 * Restoring into a *different* Supabase project is the case worth thinking
 * about before you need to. `profiles.id` is a foreign key into Supabase's
 * `auth.users`, which this backup does not contain — it is not in our schema and
 * a plain Postgres role cannot read it. So a restore into an empty project fails
 * on the very first table until those auth users exist. The script detects that
 * and says so rather than dying on a constraint. Restoring over the same project
 * the backup came from, which is the disaster this is actually for, is fine.
 */

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('\nDATABASE_URL is not set. Copy .env.example to .env.local and fill it in.\n')
  process.exit(1)
}

/** Rows per insert. Large enough to be few round trips, small enough to parse. */
const BATCH = 500

async function main() {
  const args = process.argv.slice(2)
  const replace = args.includes('--replace')
  const [path] = args.filter((arg) => !arg.startsWith('--'))

  if (!path) {
    console.error('\nUsage: npm run db:restore -- <backup.json> [--replace]\n')
    console.error('  --replace   empty the tables first, instead of refusing to overwrite\n')
    process.exit(1)
  }

  const file = resolve(path)
  console.log(`\nReading ${file}`)

  let backup: BackupFile
  try {
    backup = JSON.parse(await readFile(file, 'utf8')) as BackupFile
  } catch (error) {
    console.error(`\nCould not read that file as JSON: ${(error as Error).message}`)
    console.error('A truncated download is not a backup — take a fresh one.\n')
    process.exit(1)
  }

  if (backup.format !== BACKUP_FORMAT || !Array.isArray(backup.tables)) {
    console.error(`\nThat is not a ${BACKUP_FORMAT} file.\n`)
    process.exit(1)
  }

  /*
   * The file's own order is authoritative — it was written in foreign-key order
   * by the backup that produced it. Unknown tables are refused rather than
   * skipped: a name this schema does not have means the file came from a
   * different version of the app, and half-restoring it is worse than stopping.
   */
  const unknown = backup.tables.filter(
    (table) => !(BACKUP_TABLES as readonly string[]).includes(table.name),
  )
  if (unknown.length) {
    console.error(
      `\nThe file has tables this schema does not: ${unknown.map((t) => t.name).join(', ')}`,
    )
    console.error('It was taken from a different version of the app. Migrate first.\n')
    process.exit(1)
  }

  const missing = BACKUP_TABLES.filter(
    (name) => !backup.tables.some((table) => table.name === name),
  )
  if (missing.length) {
    console.warn(`\nNote: the file has nothing for ${missing.join(', ')} — those are left alone.`)
  }

  const total = backup.tables.reduce((sum, table) => sum + table.rows.length, 0)
  console.log(`Taken ${backup.generatedAt}, ${total.toLocaleString('en-US')} rows\n`)

  const sql = postgres(DATABASE_URL!, { prepare: false, max: 1 })

  try {
    /*
     * What is already there. Restoring on top of live data would leave a
     * database that is neither the backup nor what it was, so the default is to
     * stop and make the operator say which one they want.
     */
    const occupied: string[] = []
    for (const table of backup.tables) {
      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count from ${sql(table.name)}
      `
      if (count > 0) occupied.push(`${table.name} (${count.toLocaleString('en-US')})`)
    }

    if (occupied.length && !replace) {
      console.error('This database already has rows in:')
      for (const line of occupied) console.error(`  ${line}`)
      console.error('\nRe-run with --replace to empty those tables and restore over them.\n')
      process.exit(1)
    }

    if (replace && occupied.length) {
      console.log(`--replace: emptying ${occupied.length} table(s) first.`)
    }

    await sql.begin(async (tx) => {
      if (replace) {
        /*
         * One TRUNCATE for all of them. Separately, each would trip the others'
         * foreign keys; together, the whole set goes at once and there is
         * nothing left to point at. CASCADE covers anything outside the list
         * that references these, and RESTART IDENTITY resets sequences so a
         * restored row and a future insert cannot collide.
         */
        const names = backup.tables.map((table) => `"${table.name}"`).join(', ')
        await tx.unsafe(`truncate table ${names} restart identity cascade`)
      }

      for (const table of backup.tables) {
        if (!table.rows.length) {
          console.log(`  ${table.name.padEnd(22)} —`)
          continue
        }

        for (let i = 0; i < table.rows.length; i += BATCH) {
          const batch = table.rows.slice(i, i + BATCH)
          /*
           * `json_populate_recordset(null::"table", …)` builds rows of exactly
           * this table's column types from the JSON, so the insert needs no
           * column list and no per-type handling. The cast target is an
           * identifier and cannot be parameterised, hence `unsafe` — the name
           * came from BACKUP_TABLES, which is a literal list in this repo.
           *
           * `$1::text::json`, not `$1::json`: the driver sees a json-typed
           * parameter and helpfully JSON-encodes the string again, so the
           * server receives one JSON *string* rather than an array of rows and
           * fails with "cannot call json_populate_recordset on a scalar".
           * Landing it as text first and casting in SQL sidesteps that.
           */
          await tx.unsafe(
            `insert into "${table.name}"
             select * from json_populate_recordset(null::"${table.name}", $1::text::json)`,
            [JSON.stringify(batch)],
          )
        }

        console.log(`  ${table.name.padEnd(22)} ${table.rows.length.toLocaleString('en-US')}`)
      }
    })

    console.log(`\nRestored ${total.toLocaleString('en-US')} rows.\n`)
  } catch (error) {
    const message = (error as Error).message

    if (/profiles_id_fkey|auth\.users|violates foreign key constraint "profiles/.test(message)) {
      console.error('\nThe profiles could not be restored: their sign-in accounts do not exist.')
      console.error("`profiles.id` points at Supabase's `auth.users`, which a backup cannot read.")
      console.error('This works when restoring into the project the backup came from. Into a new')
      console.error('one, those auth users have to be recreated first — otherwise every profile is')
      console.error('an account nobody can sign into.\n')
    } else {
      console.error(`\nRestore failed: ${message}`)
      console.error('Nothing was written — the whole restore runs in one transaction.\n')
    }
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
