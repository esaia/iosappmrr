import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = postgres(url, { max: 1, prepare: false })
  try {
    await sql.unsafe(readFileSync(resolve(process.cwd(), 'supabase/policies.sql'), 'utf8'))
    console.log('Applied supabase/policies.sql')
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
