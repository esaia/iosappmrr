import './load-env'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../src/db'
import { apps, purchases } from '../src/db/schema'

/**
 * Clears purchases so a checkout can be walked through again.
 *
 * Sandbox-only by intent: it deletes rows Paddle still has transactions for, which is
 * exactly what makes a flow re-testable and exactly what would destroy the
 * audit trail behind a real payment. It refuses to run against
 * PADDLE_ENV=production for that reason.
 *
 * Deleting rather than revoking is deliberate. `revoked` is a real state the
 * app renders ("your link was withdrawn"); a founder who has never bought is a
 * founder with no row at all, and that absence is the state under test.
 *
 *   npm run paddle:reset                    # report only
 *   npm run paddle:reset -- --fix           # apply, all kinds
 *   npm run paddle:reset -- --fix --kind=dofollow
 *   npm run paddle:reset -- --fix --app=<slug>
 */
async function main() {
  const apply = process.argv.includes('--fix')

  if (process.env.PADDLE_ENV === 'production') {
    console.error('\nPADDLE_ENV=production — refusing to delete purchase history.\n')
    process.exit(1)
  }

  const kindArg = process.argv.find((a) => a.startsWith('--kind='))?.split('=')[1]
  const appArg = process.argv.find((a) => a.startsWith('--app='))?.split('=')[1]

  if (kindArg && kindArg !== 'dofollow' && kindArg !== 'sponsor') {
    console.error(`\nUnknown --kind=${kindArg}. Expected "dofollow" or "sponsor".\n`)
    process.exit(1)
  }

  let appId: string | undefined
  if (appArg) {
    const [row] = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, appArg)).limit(1)
    if (!row) {
      console.error(`\nNo app with slug "${appArg}".\n`)
      process.exit(1)
    }
    appId = row.id
  }

  const filters = [
    kindArg ? eq(purchases.kind, kindArg as 'dofollow' | 'sponsor') : undefined,
    appId ? eq(purchases.appId, appId) : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      id: purchases.id,
      kind: purchases.kind,
      status: purchases.status,
      appId: purchases.appId,
      slug: apps.slug,
      name: apps.name,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      checkoutId: purchases.checkoutId,
      dofollow: apps.websiteDofollow,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(apps, eq(apps.id, purchases.appId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(purchases.createdAt)

  if (rows.length === 0) {
    console.log('\nNo matching purchases. Nothing to reset.\n')
    return
  }

  console.log(`\n${rows.length} purchase(s) matched:\n`)
  for (const r of rows) {
    const price =
      r.amountCents == null ? '—' : `${(r.amountCents / 100).toFixed(2)} ${r.currency ?? ''}`.trim()
    console.log(
      `  ${r.kind.padEnd(8)} ${r.status.padEnd(8)} ${price.padEnd(12)} ${r.name} (${r.slug})`,
    )
    console.log(`    checkout ${r.checkoutId}  created ${r.createdAt.toISOString()}`)
  }

  /*
   * Only clear the flag on apps this run actually empties. Scoping by --kind or
   * --app can leave an active dofollow purchase behind, and that purchase is
   * still paying for the link.
   */
  const affectedAppIds = [...new Set(rows.map((r) => r.appId))]
  const deletedIds = rows.map((r) => r.id)

  if (!apply) {
    console.log('\nDry run. Re-run with --fix to delete these rows.\n')
    return
  }

  await db.delete(purchases).where(inArray(purchases.id, deletedIds))

  const survivors = await db
    .select({ appId: purchases.appId })
    .from(purchases)
    .where(
      and(
        inArray(purchases.appId, affectedAppIds),
        eq(purchases.kind, 'dofollow'),
        eq(purchases.status, 'active'),
      ),
    )

  const stillPaid = new Set(survivors.map((s) => s.appId))
  const toClear = affectedAppIds.filter((id) => !stillPaid.has(id))

  if (toClear.length) {
    await db.update(apps).set({ websiteDofollow: false }).where(inArray(apps.id, toClear))
  }

  console.log(
    `\nDeleted ${deletedIds.length} purchase(s); cleared the dofollow flag on ${toClear.length} app(s).\n`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
