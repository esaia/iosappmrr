import 'dotenv/config'
import postgres from 'postgres'
import { CATEGORIES, TECH_TAGS } from './reference-data'

/**
 * Reference data only — the category and tech-stack vocabularies the submit flow
 * needs before anyone can add an app. Unlike `seed.ts` this inserts no apps, no
 * founders and no revenue, so it is safe to run against production.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = postgres(url, { max: 1, prepare: false })

  try {
    for (const [index, [slug, name, description, genre]] of CATEGORIES.entries()) {
      await sql`
        insert into categories (slug, name, description, app_store_genre, sort_order)
        values (${slug}, ${name}, ${description}, ${genre}, ${index})
        on conflict (slug) do update set
          name = excluded.name,
          description = excluded.description,
          app_store_genre = excluded.app_store_genre,
          sort_order = excluded.sort_order
      `
    }
    console.log(`Categories: ${CATEGORIES.length}`)

    for (const [slug, name, kind] of TECH_TAGS) {
      await sql`
        insert into tech_stack_tags (slug, name, kind) values (${slug}, ${name}, ${kind})
        on conflict (slug) do update set name = excluded.name, kind = excluded.kind
      `
    }
    console.log(`Tech tags:  ${TECH_TAGS.length}`)
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
