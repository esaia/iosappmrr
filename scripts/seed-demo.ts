import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { encryptCredentials } from '../src/lib/crypto/credentials'

/**
 * Demo content for a database that has no real apps yet.
 *
 * Everything it writes is prefixed `demo-`, so `--cleanup` can remove all of it
 * without touching anything a real founder submitted. The revenue is invented —
 * run `--cleanup` before the site is public.
 */

const PREFIX = 'demo-'
const HISTORY_DAYS = 365

type DemoApp = {
  slug: string
  name: string
  tagline: string
  description: string
  category: string
  founder: string
  provider: 'revenuecat' | 'app_store_connect' | 'stripe'
  startMrrCents: number
  monthlyGrowth: number
  tech: string[]
  insights?: {
    valueProposition: string
    problemSolved: string
    audience: string
    audienceType: 'B2C' | 'B2B' | 'B2B2C'
    marketTags: string[]
    marketingChannels: string[]
    additionalInfo: string
  }
}

/*
 * Handles carry no prefix: they are public, they appear beside every app in the
 * leaderboard, and `demo-` is not something a founder could type — handles are
 * lowercase letters and numbers. The prefix lives on the e-mail instead, which
 * nobody sees and which is what `--cleanup` matches on.
 */
const FOUNDERS: [handle: string, name: string][] = [
  ['ana', 'Ana Ferreira'],
  ['tomas', 'Tomás Lind'],
  ['priya', 'Priya Raman'],
]

const APPS: DemoApp[] = [
  {
    slug: 'demo-fernweh',
    name: 'Fernweh',
    tagline: 'Plan a trip in the time it takes to make coffee',
    description:
      'Fernweh turns a rough idea and a set of dates into a day-by-day itinerary you can actually follow, with offline maps and a shared list for whoever is coming with you.',
    category: 'utilities',
    founder: 'ana',
    provider: 'revenuecat',
    startMrrCents: 410_000,
    monthlyGrowth: 0.058,
    tech: ['swiftui', 'revenuecat', 'supabase'],
    insights: {
      valueProposition:
        'Plan a trip in the time it takes to make coffee, then follow it offline once you land.',
      problemSolved:
        'Trip planning is spread across twelve browser tabs and none of it works without signal.',
      audience: 'Independent travellers who plan their own trips',
      audienceType: 'B2C',
      marketTags: ['Travel', 'Maps', 'Productivity'],
      marketingChannels: ['App store optimization', 'Content marketing', 'Instagram', 'Reddit'],
      additionalInfo: 'Offline maps licensed from OpenStreetMap; no ads, no data resale.',
    },
  },
  {
    slug: 'demo-ledgerly',
    name: 'Ledgerly',
    tagline: 'Bookkeeping that finishes itself',
    description:
      'Ledgerly reads your bank feed, proposes the categories, and closes the month for you. Built for sole traders who would rather not think about it.',
    category: 'finance',
    founder: 'tomas',
    provider: 'stripe',
    startMrrCents: 780_000,
    monthlyGrowth: 0.031,
    tech: ['swift', 'supabase', 'storekit-2'],
    insights: {
      valueProposition: 'Close your books every month without opening a spreadsheet.',
      problemSolved: 'Sole traders lose a weekend a quarter to bookkeeping they are bad at.',
      audience: 'Freelancers and sole traders in the UK and EU',
      audienceType: 'B2B',
      marketTags: ['Fintech', 'Accounting', 'SaaS'],
      marketingChannels: ['Content marketing', 'Partnerships', 'Meta Ads'],
      additionalInfo: 'Open banking via TrueLayer. Read-only access; Ledgerly never moves money.',
    },
  },
  {
    slug: 'demo-tempo',
    name: 'Tempo',
    tagline: 'A metronome that listens back',
    description:
      'Tempo follows what you are actually playing and shows where you drift, so practice time turns into progress you can see.',
    category: 'education',
    founder: 'priya',
    provider: 'app_store_connect',
    startMrrCents: 96_000,
    monthlyGrowth: 0.094,
    tech: ['swiftui', 'cloudkit'],
  },
  {
    slug: 'demo-plotline',
    name: 'Plotline',
    tagline: 'Outline a novel on your phone',
    description:
      'Scene cards, character threads and a timeline that stays readable at 400 scenes. Syncs with the desktop apps writers already use.',
    category: 'productivity',
    founder: 'ana',
    provider: 'revenuecat',
    startMrrCents: 152_000,
    monthlyGrowth: 0.042,
    tech: ['swiftui', 'revenuecat', 'cloudkit'],
  },
  {
    slug: 'demo-grainline',
    name: 'Grainline',
    tagline: 'Film simulation without the presets',
    description:
      'Grainline models the response curve of twenty stocks and applies it to raw captures, so the result holds up when you push the exposure.',
    category: 'photo-video',
    founder: 'priya',
    provider: 'revenuecat',
    startMrrCents: 288_000,
    monthlyGrowth: -0.018,
    tech: ['swift', 'revenuecat', 'storekit-2'],
  },
  {
    slug: 'demo-northwind',
    name: 'Northwind',
    tagline: 'Sailing forecasts you can read at a glance',
    description:
      'Wind, tide and swell for the next five days, drawn as one picture instead of three charts. Built with dinghy sailors and coastal crews.',
    category: 'utilities',
    founder: 'tomas',
    provider: 'app_store_connect',
    startMrrCents: 47_000,
    monthlyGrowth: 0.071,
    tech: ['swiftui', 'cloudkit'],
  },
]

/** A daily MRR series with a monthly trend, weekly seasonality and mild noise. */
function buildHistory(app: DemoApp) {
  const points: { date: Date; mrrCents: number }[] = []
  // Deterministic per-app jitter, so repeated runs produce the same numbers.
  let seed = [...app.slug].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed / 0xffffffff
  }

  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - i)

    const monthsElapsed = (HISTORY_DAYS - 1 - i) / 30
    const trend = app.startMrrCents * Math.pow(1 + app.monthlyGrowth, monthsElapsed)
    // Subscriptions renew on weekday billing cycles, so weekends dip slightly.
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.985 : 1
    const noise = 0.97 + random() * 0.06

    points.push({ date, mrrCents: Math.max(1000, Math.round(trend * weekend * noise)) })
  }

  return points
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const sql = postgres(url, { max: 1, prepare: false })

  try {
    if (process.argv.includes('--cleanup')) return teardown(sql)

    const missing = await sql<{ c: number }[]>`select count(*)::int c from categories`
    if (missing[0].c === 0) {
      throw new Error('No categories. Run `npm run db:reference` first.')
    }

    console.log('Creating demo founders…')
    const founderIds = new Map<string, string>()
    for (const [handle, name] of FOUNDERS) {
      const email = `${PREFIX}${handle}@trustmrr.invalid`
      // auth.users has no plain unique index on email on hosted Supabase, so
      // look before inserting rather than relying on ON CONFLICT.
      let [user] = await sql<{ id: string }[]>`
        select id from auth.users where email = ${email} limit 1`
      if (!user) {
        ;[user] = await sql<{ id: string }[]>`
          insert into auth.users (id, instance_id, aud, role, email)
          values (${randomUUID()}, ${'00000000-0000-0000-0000-000000000000'},
                  'authenticated', 'authenticated', ${email})
          returning id`
      }
      await sql`
        insert into profiles (id, handle, name, bio)
        values (${user.id}, ${handle}, ${name}, ${'Demo account — not a real founder.'})
        on conflict (id) do update set handle = excluded.handle, name = excluded.name
      `
      founderIds.set(handle, user.id)
    }

    console.log(`Creating ${APPS.length} demo apps with ${HISTORY_DAYS} days of history…`)
    for (const app of APPS) {
      const [category] = await sql<{ id: string }[]>`
        select id from categories where slug = ${app.category}`

      const launchedAt = new Date()
      launchedAt.setUTCDate(launchedAt.getUTCDate() - HISTORY_DAYS - 90)

      const [row] = await sql<{ id: string }[]>`
        insert into apps (
          slug, name, tagline, description, app_store_id, app_store_url,
          founder_id, category_id, status, is_verified, verified_at, launched_at,
          value_proposition, problem_solved, audience, audience_type,
          market_tags, marketing_channels, additional_info
        ) values (
          ${app.slug}, ${app.name}, ${app.tagline}, ${app.description},
          ${String(1_000_000_000 + [...app.slug].reduce((a, c) => a + c.charCodeAt(0), 0) * 7919)},
          ${'https://apps.apple.com/app/id' + app.slug},
          ${founderIds.get(app.founder)!}, ${category?.id ?? null},
          'live', true, now(), ${launchedAt.toISOString().slice(0, 10)},
          ${app.insights?.valueProposition ?? null}, ${app.insights?.problemSolved ?? null},
          ${app.insights?.audience ?? null}, ${app.insights?.audienceType ?? null},
          ${JSON.stringify(app.insights?.marketTags ?? [])},
          ${JSON.stringify(app.insights?.marketingChannels ?? [])},
          ${app.insights?.additionalInfo ?? null}
        )
        on conflict (slug) do update set
          name = excluded.name, tagline = excluded.tagline, description = excluded.description,
          value_proposition = excluded.value_proposition,
          problem_solved = excluded.problem_solved,
          audience = excluded.audience, audience_type = excluded.audience_type,
          market_tags = excluded.market_tags,
          marketing_channels = excluded.marketing_channels,
          additional_info = excluded.additional_info
        returning id
      `

      await sql`delete from app_tech_stack where app_id = ${row.id}`
      for (const tech of app.tech) {
        await sql`
          insert into app_tech_stack (app_id, tag_id)
          select ${row.id}, id from tech_stack_tags where slug = ${tech}
          on conflict do nothing
        `
      }

      const history = buildHistory(app)
      await sql`delete from revenue_snapshots where app_id = ${row.id}`

      const rows = history.map((point) => ({
        app_id: row.id,
        provider: app.provider,
        captured_on: point.date.toISOString().slice(0, 10),
        captured_at: point.date.toISOString(),
        mrr_cents: point.mrrCents,
        active_subscriptions: Math.round(point.mrrCents / 100 / 8.5),
        active_trials: Math.round(point.mrrCents / 100 / 140),
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
          ${row.id}, ${app.provider}, 'active',
          ${encryptCredentials({ demo: true })}, ${'Demo connection'}, now()
        )
        on conflict (app_id, provider) do update set
          status = 'active', last_error = null, consecutive_failures = 0, last_synced_at = now()
      `

      console.log(`  ${app.name}`)
    }

    const { recomputeAppMetrics } = await import('../src/lib/metrics')
    const appRows = await sql<{ id: string }[]>`
      select id from apps where slug like ${PREFIX + '%'}`
    for (const app of appRows) await recomputeAppMetrics(app.id)

    const [{ count }] = await sql<{ count: string }[]>`
      select count(*) from revenue_snapshots`
    console.log(
      `\nDone. ${appRows.length} demo apps, ${count} snapshots.\n` +
        `Remove it all with: npm run db:demo -- --cleanup`,
    )
  } finally {
    await sql.end()
  }
}

/** Removes every demo row. Deleting the auth user cascades to its profile and apps. */
async function teardown(sql: postgres.Sql) {
  const apps = await sql`delete from apps where slug like ${PREFIX + '%'} returning id`
  const users = await sql`
    delete from auth.users where email like ${PREFIX + '%@trustmrr.invalid'} returning id`
  console.log(`Removed ${apps.length} demo apps and ${users.length} demo accounts.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
