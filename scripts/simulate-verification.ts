import 'dotenv/config'
import postgres from 'postgres'
import { encryptCredentials } from '../src/lib/crypto/credentials'

/**
 * Fakes a verified provider connection for one app, so the live app page can be
 * seen without owning a RevenueCat or App Store Connect account.
 *
 * This writes invented revenue and bypasses the provider adapters entirely — it
 * proves the pages render, not that verification works. The connection is
 * labelled so it is obvious in the dashboard, and `--undo` removes everything.
 *
 *   npm run db:simulate -- <appId>
 *   npm run db:simulate -- <appId> --undo
 */

const DAYS = 365
const START_MRR_CENTS = 120_000
const MONTHLY_GROWTH = 0.061
const PROVIDER = 'revenuecat'
const LABEL = 'Simulated — not a real connection'

function buildHistory(seedText: string) {
  let seed = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 11)
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed / 0xffffffff
  }

  const points: { date: Date; mrrCents: number }[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - i)

    const months = (DAYS - 1 - i) / 30
    const trend = START_MRR_CENTS * Math.pow(1 + MONTHLY_GROWTH, months)
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.985 : 1
    points.push({
      date,
      mrrCents: Math.max(1000, Math.round(trend * weekend * (0.97 + random() * 0.06))),
    })
  }
  return points
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const appId = process.argv.find((arg) => /^[0-9a-f-]{36}$/i.test(arg))
  if (!appId) throw new Error('Pass the app id: npm run db:simulate -- <appId>')

  const sql = postgres(url, { max: 1, prepare: false })

  try {
    const [app] = await sql<{ id: string; name: string; slug: string }[]>`
      select id, name, slug from apps where id = ${appId}`
    if (!app) throw new Error('No app with that id.')

    if (process.argv.includes('--undo')) {
      await sql`delete from revenue_snapshots where app_id = ${appId}`
      await sql`delete from revenue_connections where app_id = ${appId} and account_label = ${LABEL}`
      await sql`delete from app_metrics where app_id = ${appId}`
      await sql`update apps set status = 'draft', is_verified = false, verified_at = null
                where id = ${appId}`
      console.log(`Reverted ${app.name} to an unverified draft.`)
      return
    }

    const history = buildHistory(app.slug)
    await sql`delete from revenue_snapshots where app_id = ${appId}`

    const rows = history.map((point) => ({
      app_id: appId,
      provider: PROVIDER,
      captured_on: point.date.toISOString().slice(0, 10),
      captured_at: point.date.toISOString(),
      mrr_cents: point.mrrCents,
      active_subscriptions: Math.round(point.mrrCents / 100 / 7.5),
      active_trials: Math.round(point.mrrCents / 100 / 120),
      revenue_28d_cents: Math.round(point.mrrCents * 0.94),
      currency: 'USD',
    }))
    for (let i = 0; i < rows.length; i += 500) {
      await sql`insert into revenue_snapshots ${sql(rows.slice(i, i + 500))}`
    }

    await sql`
      insert into revenue_connections (
        app_id, provider, status, encrypted_credentials, account_label, last_synced_at
      )
      values (
        ${appId}, ${PROVIDER}, 'active',
        ${encryptCredentials({ simulated: true })}, ${LABEL}, now()
      )
      on conflict (app_id, provider) do update set
        status = 'active', account_label = ${LABEL}, last_synced_at = now()
    `

    await sql`update apps set status = 'live', is_verified = true, verified_at = now()
              where id = ${appId}`

    const { recomputeAppMetrics } = await import('../src/lib/metrics')
    await recomputeAppMetrics(appId)

    const latest = history[history.length - 1].mrrCents
    console.log(
      `${app.name} is now live with simulated revenue.\n` +
        `  MRR: $${(latest / 100).toFixed(2)} across ${DAYS} days\n` +
        `  Page: /apps/${app.slug}\n\n` +
        `Undo with: npm run db:simulate -- ${appId} --undo`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
