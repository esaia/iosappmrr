import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
}

/**
 * Supabase's pooler does not support prepared statements, and Next.js hot
 * reloads would otherwise open a new pool on every edit.
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> }

const sql = globalForDb.sql ?? postgres(connectionString, { prepare: false, max: 10 })

if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql

export const db = drizzle(sql, { schema, casing: 'snake_case' })
export { schema }
