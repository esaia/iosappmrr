import './load-env'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '../src/db'
import { appStoreMetadata, apps } from '../src/db/schema'
import { ASO_BAND_LABEL, asoBand } from '../src/lib/appstore/aso'
import { syncAppStoreMetadata } from '../src/lib/sync'

/**
 * Prints the listing-quality score the daily metadata sync has already stored
 * for every live app. `--refresh` runs that sync first, which is how a score
 * gets backfilled without waiting for the 04:30 cron.
 */

const bar = (fraction: number) => {
  const filled = Math.round(fraction * 20)
  return '█'.repeat(filled) + '·'.repeat(20 - filled)
}

async function main() {
  if (process.argv.includes('--refresh')) {
    const report = await syncAppStoreMetadata()
    console.log(
      `Refreshed ${report.updated}/${report.attempted} listings from Apple` +
        (report.missing ? `, ${report.missing} not found` : ''),
    )
  }

  const rows = await db
    .select({
      slug: apps.slug,
      name: apps.name,
      score: appStoreMetadata.asoScore,
      signals: appStoreMetadata.asoSignals,
      fetchedAt: appStoreMetadata.fetchedAt,
    })
    .from(apps)
    .innerJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(and(eq(apps.status, 'live'), isNotNull(appStoreMetadata.asoScore)))

  if (rows.length === 0) {
    console.log('No scored listings yet. Run with --refresh to score them now.')
    return
  }

  rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  console.log('\nListing quality — public App Store signals only\n')
  for (const row of rows) {
    console.log(
      `${String(row.score).padStart(4)}  ${ASO_BAND_LABEL[asoBand(row.score ?? 0)].padEnd(11)} ${row.name}`,
    )
  }

  for (const row of rows) {
    console.log(`\n\n=== ${row.name} — ${row.score}/100 ===`)
    for (const signal of row.signals ?? []) {
      const earned = (signal.score * signal.weight).toFixed(1).padStart(5)
      console.log(
        `  ${signal.label.padEnd(16)} ${bar(signal.score)} ${earned}/${String(signal.weight).padEnd(3)} ${signal.detail}`,
      )
    }
  }
  console.log()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
