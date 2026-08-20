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
/**
 * A settled app, not a growth story: MRR hovers around this figure for the
 * whole year instead of climbing. At steady state a subscription business
 * collects about its MRR each month, so this doubles as the monthly takings.
 */
const TARGET_MRR_CENTS = 100_000
/**
 * Days simulated before the visible window, and discarded.
 *
 * Two reasons, and the second is why this is measured in years rather than
 * months. The first: a history generated from an empty database has nobody old
 * enough to renew, so every annual charge would be somebody's first and the
 * renewals that make the daily line lumpy would all be missing.
 *
 * The second: an annual plan churning at 28% a renewal lasts about three and a
 * half years, so a subscriber population takes that long to stop growing. Burn
 * in for one year and the visible window still catches the tail of the fill-up
 * — MRR drifts upward across it and the chart reads as a growth curve, which is
 * exactly what this is meant not to be. Five years in, arrivals and departures
 * balance and the line goes sideways.
 */
const BURN_IN_DAYS = 365 * 5

/**
 * The plan mix, which is what shapes the daily revenue line.
 *
 * Annual plans dominate deliberately. They are charged once, in whatever size
 * cluster signed up together a year earlier, which is what puts $0 on most days
 * and several hundred dollars on a few. A catalogue of monthly plans alone
 * collects a little every day and draws almost a straight line.
 */
const PLANS = [
  { share: 0.9, priceCents: 9999, periodDays: 365, churnAtRenewal: 0.28 },
  { share: 0.1, priceCents: 999, periodDays: 30, churnAtRenewal: 0.055 },
] as const

const PROVIDER = 'revenuecat'
const LABEL = 'Simulated — not a real connection'

/**
 * Installs ride on a second, installs-only connection, because that is the only
 * shape this can take for real: RevenueCat cannot report downloads, so an app
 * whose money comes from it needs an App Store Connect key beside it to chart
 * them. Writing both from one provider would test a combination that cannot
 * exist.
 */
const INSTALLS_PROVIDER = 'app_store_connect'
const INSTALLS_LABEL = 'Simulated installs — not a real connection'

/**
 * Share of installs that ever subscribe. Deliberately low: most people who
 * download an app never pay for it, which is the whole reason installs are
 * worth charting separately from revenue.
 */
const CONVERSION_RATE = 0.03

/**
 * Downloads a day from people who were never going to subscribe — the bulk of
 * the line, and what keeps it from being a scaled copy of the signup series.
 */
const BROWSING_INSTALLS = 38

type Day = {
  date: Date
  mrrCents: number
  subscribers: number
  trials: number
  revenueCents: number
  revenue28dCents: number
  newCustomers28d: number
  installs: number
}

function makeRandom(seedText: string) {
  let seed = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 11)
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed / 0xffffffff
  }
}

/** Knuth's method. Signups are whole people, so the daily count is a small
 * integer that is very often zero. */
function poisson(mean: number, random: () => number) {
  const limit = Math.exp(-mean)
  let count = 0
  let product = random()
  while (product > limit && count < 60) {
    count++
    product *= random()
  }
  return count
}

type Sub = { start: number; priceCents: number; periodDays: number; churnAtRenewal: number }

/**
 * One run of the subscription business at a given acquisition rate.
 *
 * Every subscription is tracked individually and charged on the anniversary of
 * the day it started, because that is where the shape of the daily revenue line
 * comes from. Signups arrive in bursts — an App Store feature, a post that did
 * well — and a year later that burst renews on a single day as one large
 * charge. Spreading charges evenly across subscribers, which is the obvious
 * shortcut, erases both the empty days and the spikes.
 */
function simulate(seedText: string, rateScale: number): Day[] {
  const random = makeRandom(seedText)
  const total = BURN_IN_DAYS + DAYS

  /*
   * A multiplier per month, drawn once, centred on 1 and with no trend in it.
   * Some months are quieter than others; none of them is the start of a climb.
   */
  const regimes: number[] = []
  for (let month = 0; month <= Math.ceil(total / 30); month++) {
    regimes.push(0.75 + random() * 0.55)
  }

  let live: Sub[] = []
  const days: Day[] = []
  const recentSignups: number[] = []
  const dailyRevenue: number[] = []

  for (let i = 0; i < total; i++) {
    let revenueCents = 0

    // Renewals first, so a plan bought today is not also renewed today.
    const surviving: Sub[] = []
    for (const sub of live) {
      const due = i > sub.start && (i - sub.start) % sub.periodDays === 0
      if (!due) {
        surviving.push(sub)
        continue
      }
      // Cancelling takes effect at the end of a period, so churn is decided
      // at renewal rather than on some arbitrary day mid-cycle.
      if (random() < sub.churnAtRenewal) continue
      revenueCents += sub.priceCents
      surviving.push(sub)
    }
    live = surviving

    /*
     * Acquisition is clumpy. Most days bring nobody; now and then something
     * lands and brings a handful at once. This is the burstiness the annual
     * renewals inherit a year later.
     */
    const regime = regimes[Math.floor(i / 30)] ?? 1
    const burst = random() < 0.07
    const newSubs = poisson((burst ? 7.5 : 0.09) * rateScale * regime, random)

    for (let n = 0; n < newSubs; n++) {
      const plan = random() < PLANS[0].share ? PLANS[0] : PLANS[1]
      live.push({
        start: i,
        priceCents: plan.priceCents,
        periodDays: plan.periodDays,
        churnAtRenewal: plan.churnAtRenewal,
      })
      // The first charge lands the day they subscribe.
      revenueCents += plan.priceCents
    }

    /*
     * Installs, in the same regime and burst the signups saw — a launch is a
     * spike in both — plus a floor of people who look and leave. Derived from
     * the day's signups rather than the other way round, so tuning MRR does not
     * have to fight a second objective.
     */
    const installs =
      poisson(BROWSING_INSTALLS * regime * (burst ? 4 : 1), random) +
      Math.round((newSubs / CONVERSION_RATE) * (0.75 + random() * 0.5))

    recentSignups.push(newSubs)
    if (recentSignups.length > 28) recentSignups.shift()
    dailyRevenue.push(revenueCents)
    if (dailyRevenue.length > 28) dailyRevenue.shift()

    if (i < BURN_IN_DAYS) continue

    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - (total - 1 - i))

    // An annual plan counts as a twelfth of its price per month, so the two
    // plans are comparable and MRR means one thing.
    const mrrCents = Math.round(
      live.reduce((sum, sub) => sum + (sub.priceCents * 30) / sub.periodDays, 0),
    )

    const weekIntake = recentSignups.slice(-7).reduce((sum, n) => sum + n, 0)

    days.push({
      date,
      mrrCents,
      subscribers: live.length,
      trials: Math.max(0, Math.round(weekIntake * (0.8 + random() * 1.4))),
      revenueCents,
      revenue28dCents: dailyRevenue.reduce((sum, n) => sum + n, 0),
      newCustomers28d: recentSignups.reduce((sum, n) => sum + n, 0),
      installs,
    })
  }

  return days
}

/**
 * Searches for the acquisition rate whose year *averages* the target.
 *
 * Deliberately the mean rather than the closing value: pinning the last day
 * would let the run drift and then be dragged back at the end, which is the
 * growth curve this is meant to avoid.
 *
 * Bisection rather than the obvious `scale *= target / actual` fixed point.
 * `poisson` draws a variable number of random numbers depending on its mean, so
 * changing the rate reshuffles every draw after it — the objective is monotone
 * on average but jumps around locally, and the fixed point oscillates instead
 * of settling. Bisection only needs the average behaviour.
 */
function buildHistory(seedText: string) {
  const meanMrr = (list: Day[]) => list.reduce((sum, d) => sum + d.mrrCents, 0) / list.length

  let lo = 0.01
  let hi = 100
  let best = simulate(seedText, 1)

  for (let attempt = 0; attempt < 40; attempt++) {
    const mid = (lo + hi) / 2
    const days = simulate(seedText, mid)
    const average = meanMrr(days)

    // Keep the closest run seen, so a search that never lands inside the
    // tolerance still returns its best attempt rather than its last one.
    if (Math.abs(average - TARGET_MRR_CENTS) < Math.abs(meanMrr(best) - TARGET_MRR_CENTS)) {
      best = days
    }
    if (Math.abs(average - TARGET_MRR_CENTS) / TARGET_MRR_CENTS < 0.02) return days
    if (average < TARGET_MRR_CENTS) lo = mid
    else hi = mid
  }

  return best
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
      await sql`delete from revenue_connections where app_id = ${appId}
                and account_label in (${LABEL}, ${INSTALLS_LABEL})`
      await sql`delete from app_metrics where app_id = ${appId}`
      await sql`update apps set status = 'draft', is_verified = false, verified_at = null
                where id = ${appId}`
      console.log(`Reverted ${app.name} to an unverified draft.`)
      return
    }

    const history = buildHistory(app.slug)
    await sql`delete from revenue_snapshots where app_id = ${appId}`

    const rows = history.map((day) => ({
      app_id: appId,
      provider: PROVIDER,
      captured_on: day.date.toISOString().slice(0, 10),
      captured_at: day.date.toISOString(),
      mrr_cents: day.mrrCents,
      active_subscriptions: day.subscribers,
      active_trials: day.trials,
      new_customers_28d: day.newCustomers28d,
      revenue_cents: day.revenueCents,
      revenue_28d_cents: day.revenue28dCents,
      currency: 'USD',
    }))
    /*
     * A second row per day, from the installs-only connection. Separate rows
     * rather than an `installs` column on the RevenueCat ones, because that is
     * how the sync writes them: one row per provider per day, and this pair is
     * what the chart has to add up correctly.
     *
     * mrr_cents is 0 and installs_only is true, which is what keeps the app's
     * MRR from doubling — the same flag the aggregates filter on.
     */
    const installsRows = history.map((day) => ({
      app_id: appId,
      provider: INSTALLS_PROVIDER,
      captured_on: day.date.toISOString().slice(0, 10),
      captured_at: day.date.toISOString(),
      mrr_cents: 0,
      installs: day.installs,
      installs_only: true,
      currency: 'USD',
    }))

    for (let i = 0; i < rows.length; i += 500) {
      await sql`insert into revenue_snapshots ${sql(rows.slice(i, i + 500))}`
    }
    for (let i = 0; i < installsRows.length; i += 500) {
      await sql`insert into revenue_snapshots ${sql(installsRows.slice(i, i + 500))}`
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

    await sql`
      insert into revenue_connections (
        app_id, provider, status, encrypted_credentials, account_label,
        installs_only, last_synced_at
      )
      values (
        ${appId}, ${INSTALLS_PROVIDER}, 'active',
        ${encryptCredentials({ simulated: true })}, ${INSTALLS_LABEL}, true, now()
      )
      on conflict (app_id, provider) do update set
        status = 'active', account_label = ${INSTALLS_LABEL},
        installs_only = true, last_synced_at = now()
    `

    await sql`update apps set status = 'live', is_verified = true, verified_at = now()
              where id = ${appId}`

    const { recomputeAppMetrics } = await import('../src/lib/metrics')
    await recomputeAppMetrics(appId)

    const last30 = history.slice(-30)
    const mrrs = history.map((d) => d.mrrCents)
    console.log(
      `${app.name} is now live with simulated revenue.\n` +
        `  MRR: $${(history[history.length - 1].mrrCents / 100).toFixed(2)} ` +
        `(year low $${(Math.min(...mrrs) / 100).toFixed(0)}, high $${(Math.max(...mrrs) / 100).toFixed(0)})\n` +
        `  Subscribers: ${history[history.length - 1].subscribers}\n` +
        `  Last 30d takings: $${(last30.reduce((s, d) => s + d.revenueCents, 0) / 100).toFixed(2)} ` +
        `across ${last30.filter((d) => d.revenueCents > 0).length}/30 days\n` +
        `  Last 30d installs: ${last30.reduce((s, d) => s + d.installs, 0)} ` +
        `(peak day ${Math.max(...history.map((d) => d.installs))})\n` +
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
