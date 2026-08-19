import { describe, expect, it } from 'vitest'
import { getTableName, is, Table } from 'drizzle-orm'
import * as schema from '@/db/schema'
import { backupFilename, BACKUP_TABLES } from './backup-tables'

/*
 * `schema` also exports enums and relations, so the tables are picked out by
 * what they are rather than by name — a table added under any name is caught.
 */
const schemaTables = Object.values(schema as Record<string, unknown>)
  .filter((value): value is Table => is(value, Table))
  .map((table) => getTableName(table))

describe('BACKUP_TABLES', () => {
  /*
   * The whole point of the list. A table added to the schema and forgotten here
   * would back up silently and restore as empty, which is the one failure mode
   * a backup must not have.
   */
  it('covers every table in the schema', () => {
    expect([...BACKUP_TABLES].sort()).toEqual([...schemaTables].sort())
  })

  it('names no table twice', () => {
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length)
  })

  it('lists a table only after the tables it references', () => {
    expect(BACKUP_TABLES.indexOf('apps')).toBeGreaterThan(BACKUP_TABLES.indexOf('profiles'))
    expect(BACKUP_TABLES.indexOf('purchases')).toBeGreaterThan(BACKUP_TABLES.indexOf('apps'))
    expect(BACKUP_TABLES.indexOf('revenue_snapshots')).toBeGreaterThan(
      BACKUP_TABLES.indexOf('apps'),
    )
  })
})

describe('backupFilename', () => {
  it('stamps the file with the minute it was taken', () => {
    expect(backupFilename(new Date('2026-08-19T14:32:05.000Z'))).toBe(
      'trustmrr-backup-2026-08-19-1432.json',
    )
  })
})
