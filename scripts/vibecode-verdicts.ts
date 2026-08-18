import './load-env'
import { eq, ne, or, isNull } from 'drizzle-orm'
import pLimit from 'p-limit'
import { db } from '../src/db'
import { apps, vibecodeVerdicts } from '../src/db/schema'
import { getVerdictInput, saveVerdict } from '../src/lib/data/vibecode'
import { DEFAULT_MODEL, PROMPT_VERSION, draftVerdict, isConfigured } from '../src/lib/vibecode'

/**
 * Drafts the "Can I vibecode it?" verdict for live apps that lack a current one.
 *
 * Verdicts are cached per app and never generated on the render path, so this
 * script is how they come into being. It is safe to re-run: an app whose
 * verdict already matches the current prompt version is skipped, so the cost is
 * paid once per app rather than once per run.
 *
 *   npm run vibecode                 # report what would be drafted
 *   npm run vibecode -- --fix        # draft and store
 *   npm run vibecode -- --fix --app=<slug>
 *   npm run vibecode -- --fix --all  # include apps already at this version
 */

const CONCURRENCY = 3

async function main() {
  const apply = process.argv.includes('--fix')
  const all = process.argv.includes('--all')
  const slug = process.argv.find((a) => a.startsWith('--app='))?.split('=')[1]

  if (!isConfigured()) {
    console.error('\nOPENAI_API_KEY is not set. Add it to .env first.\n')
    process.exit(1)
  }

  /*
   * A human edit outranks the model: rows marked `edited_by_human` are never
   * redrafted, even by --all, or a backfill would silently discard someone's
   * correction to a verdict about their own app.
   */
  const rows = await db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      edited: vibecodeVerdicts.editedByHuman,
      version: vibecodeVerdicts.promptVersion,
    })
    .from(apps)
    .leftJoin(vibecodeVerdicts, eq(vibecodeVerdicts.appId, apps.id))
    .where(
      slug
        ? eq(apps.slug, slug)
        : all
          ? eq(apps.status, 'live')
          : // Missing, or written by an older prompt.
            or(isNull(vibecodeVerdicts.id), ne(vibecodeVerdicts.promptVersion, PROMPT_VERSION)),
    )

  const targets = rows.filter((r) => !r.edited)
  const skipped = rows.length - targets.length

  if (targets.length === 0) {
    console.log(
      `\nNothing to draft.${skipped ? ` ${skipped} human-edited row(s) left alone.` : ''}\n`,
    )
    return
  }

  console.log(
    `\n${targets.length} app(s) to draft with ${DEFAULT_MODEL} (prompt v${PROMPT_VERSION})`,
  )
  if (skipped) console.log(`${skipped} human-edited row(s) left alone.`)

  if (!apply) {
    for (const t of targets)
      console.log(`  ${t.slug}${t.version ? ` (v${t.version} → v${PROMPT_VERSION})` : ' (new)'}`)
    console.log('\nDry run. Re-run with --fix to call the API and store results.\n')
    return
  }

  const limit = pLimit(CONCURRENCY)
  let done = 0
  let failed = 0

  await Promise.all(
    targets.map((target) =>
      limit(async () => {
        try {
          const input = await getVerdictInput(target.id)
          if (!input) throw new Error('app vanished')

          const draft = await draftVerdict(input)
          await saveVerdict({ appId: target.id, draft, model: DEFAULT_MODEL })

          done++
          console.log(`  ${target.slug.padEnd(28)} ${draft.verdict.padEnd(11)} ${draft.headline}`)
        } catch (error) {
          failed++
          // One bad app must not abandon the rest of the batch.
          console.error(`  ${target.slug.padEnd(28)} FAILED  ${(error as Error).message}`)
        }
      }),
    ),
  )

  console.log(`\nDrafted ${done}. ${failed ? `${failed} failed.` : ''}\n`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
