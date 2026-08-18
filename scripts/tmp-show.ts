import './load-env'
import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { apps, vibecodeVerdicts } from '../src/db/schema'

async function main() {
  const rows = await db
    .select({ slug: apps.slug, v: vibecodeVerdicts })
    .from(vibecodeVerdicts)
    .innerJoin(apps, eq(apps.id, vibecodeVerdicts.appId))
  for (const { slug, v } of rows) {
    console.log(`\n=== ${slug} — ${v.verdict} (${v.model}) ===`)
    console.log(`headline : ${v.headline}`)
    console.log(`reasoning: ${v.reasoning}`)
    console.log(`rebuild  : ${v.rebuildable.map((s) => '\n   - ' + s).join('')}`)
    console.log(`moat     : ${v.moat.map((s) => '\n   - ' + s).join('')}`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
