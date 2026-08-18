import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { encryptCredentials } from '../src/lib/crypto/credentials'
import { CATEGORIES, TECH_TAGS } from './reference-data'

/**
 * Development seed.
 *
 * Every app and founder here is fictional. This site publishes revenue claims,
 * so seeding invented figures against real companies' names — even locally —
 * risks those numbers escaping into something that looks authoritative. The
 * App Store enrichment path is exercised for real by the submit flow instead.
 */

type SeedApp = {
  slug: string
  name: string
  tagline: string
  description: string
  category: string
  tech: string[]
  founder: string
  /** Current MRR in dollars, and the monthly growth rate that produced it. */
  mrr: number
  monthlyGrowth: number
  provider: 'revenuecat' | 'app_store_connect' | 'stripe'
  extraProvider?: 'stripe'
  ageMonths: number
}

const FOUNDERS = [
  ['marasolberg', 'Mara Solberg'],
  ['devkohli', 'Dev Kohli'],
  ['inesmoreau', 'Inès Moreau'],
  ['tobiaslindqvist', 'Tobias Lindqvist'],
  ['ameliaokafor', 'Amelia Okafor'],
  ['renzoibarra', 'Renzo Ibarra'],
  ['haruna-sato', 'Haruna Sato'],
  ['kwesiboateng', 'Kwesi Boateng'],
] as const

const APPS: SeedApp[] = [
  {
    slug: 'lumen-sleep',
    name: 'Lumen Sleep',
    tagline: 'Wind-down routines that actually stick',
    description:
      'Lumen builds a wind-down routine around your real bedtime, not an ideal one. It reads sleep stages from Apple Health, notices the nights that went wrong, and adjusts tomorrow rather than lecturing you about last night.',
    category: 'health-fitness',
    tech: ['swiftui', 'cloudkit', 'revenuecat'],
    founder: 'marasolberg',
    mrr: 182_400,
    monthlyGrowth: 0.061,
    provider: 'revenuecat',
    ageMonths: 34,
  },
  {
    slug: 'shotlist',
    name: 'Shotlist',
    tagline: 'Storyboards for people who shoot alone',
    description:
      'Plan a shoot on your phone, then run it from your wrist. Shotlist keeps the frame, the lens, and the light for every setup, and checks them off as you go.',
    category: 'photo-video',
    tech: ['swiftui', 'supabase', 'revenuecat'],
    founder: 'inesmoreau',
    mrr: 74_900,
    monthlyGrowth: 0.084,
    provider: 'revenuecat',
    extraProvider: 'stripe',
    ageMonths: 22,
  },
  {
    slug: 'ledgerly',
    name: 'Ledgerly',
    tagline: 'Envelope budgeting without the spreadsheet',
    description:
      'Every pound gets a job the day it lands. Ledgerly connects to your bank, sorts the noise, and shows one number: what is actually free to spend this week.',
    category: 'finance',
    tech: ['swift', 'uikit', 'storekit-2'],
    founder: 'tobiaslindqvist',
    mrr: 61_250,
    monthlyGrowth: 0.038,
    provider: 'app_store_connect',
    ageMonths: 48,
  },
  {
    slug: 'kettle',
    name: 'Kettle',
    tagline: 'A timer that understands recipes',
    description:
      'Paste a recipe and Kettle finds every duration in it, then runs them as one nested timer. Built because kitchen timers assume you are cooking one thing.',
    category: 'utilities',
    tech: ['swiftui', 'storekit-2'],
    founder: 'devkohli',
    mrr: 8_940,
    monthlyGrowth: 0.112,
    provider: 'revenuecat',
    ageMonths: 11,
  },
  {
    slug: 'parseless',
    name: 'Parseless',
    tagline: 'Read any API from your phone',
    description:
      'A real HTTP client for iOS: environments, auth flows, saved collections, and a response viewer that does not choke on a megabyte of JSON.',
    category: 'developer-tools',
    tech: ['swiftui', 'swift', 'revenuecat'],
    founder: 'kwesiboateng',
    mrr: 23_100,
    monthlyGrowth: 0.055,
    provider: 'revenuecat',
    ageMonths: 19,
  },
  {
    slug: 'tonebridge-ai',
    name: 'Tonebridge',
    tagline: 'Rewrite anything in your own voice',
    description:
      'Tonebridge learns how you write from the messages you already sent, then rewrites drafts to match. Runs on-device for anything under a page.',
    category: 'ai',
    tech: ['swiftui', 'supabase', 'superwall', 'revenuecat'],
    founder: 'ameliaokafor',
    mrr: 128_700,
    monthlyGrowth: 0.147,
    provider: 'revenuecat',
    ageMonths: 14,
  },
  {
    slug: 'stride-coach',
    name: 'Stride',
    tagline: 'Marathon plans that adapt to the week you had',
    description:
      'Missed two runs? Stride rebuilds the block instead of pretending it did not happen. Reads heart rate and pace from Apple Watch and moves the hard days to where they fit.',
    category: 'health-fitness',
    tech: ['swiftui', 'cloudkit', 'revenuecat'],
    founder: 'renzoibarra',
    mrr: 44_600,
    monthlyGrowth: 0.029,
    provider: 'revenuecat',
    ageMonths: 41,
  },
  {
    slug: 'kanji-drift',
    name: 'Kanji Drift',
    tagline: 'Spaced repetition that fits a commute',
    description:
      'Five minutes of kanji, tuned to the train you take. Kanji Drift schedules reviews around the gaps in your calendar rather than a fixed daily target.',
    category: 'education',
    tech: ['flutter', 'firebase', 'revenuecat'],
    founder: 'haruna-sato',
    mrr: 17_800,
    monthlyGrowth: 0.043,
    provider: 'revenuecat',
    ageMonths: 27,
  },
  {
    slug: 'quiethours',
    name: 'Quiet Hours',
    tagline: 'Focus modes that switch themselves',
    description:
      'Quiet Hours reads your calendar and location and turns the right Focus on before the meeting starts. No shortcuts to maintain.',
    category: 'productivity',
    tech: ['swiftui', 'storekit-2'],
    founder: 'devkohli',
    mrr: 5_320,
    monthlyGrowth: 0.078,
    provider: 'app_store_connect',
    ageMonths: 8,
  },
  {
    slug: 'foldmap',
    name: 'Foldmap',
    tagline: 'Offline trail maps with real contour detail',
    description:
      'Download a region once and get contours, water, and paths that stay legible at speed. Built for the places where the signal stops.',
    category: 'utilities',
    tech: ['swift', 'uikit', 'revenuecat'],
    founder: 'tobiaslindqvist',
    mrr: 31_400,
    monthlyGrowth: 0.021,
    provider: 'revenuecat',
    ageMonths: 55,
  },
  {
    slug: 'coterie',
    name: 'Coterie',
    tagline: 'Group chat that ends on purpose',
    description:
      'Every Coterie thread has an expiry. Plan the trip, argue about the restaurant, and let it disappear when it is over.',
    category: 'social',
    tech: ['react-native', 'expo', 'supabase', 'revenuecat'],
    founder: 'ameliaokafor',
    mrr: 12_050,
    monthlyGrowth: 0.093,
    provider: 'revenuecat',
    ageMonths: 13,
  },
  {
    slug: 'tidebreak',
    name: 'Tidebreak',
    tagline: 'A surf forecast you can read in one glance',
    description:
      'Swell, wind, and tide reduced to a single call: go now, go later, or do not bother. Covers 4,000 breaks.',
    category: 'utilities',
    tech: ['swiftui', 'supabase', 'revenuecat'],
    founder: 'renzoibarra',
    mrr: 9_780,
    monthlyGrowth: 0.034,
    provider: 'revenuecat',
    ageMonths: 30,
  },
  {
    slug: 'pocket-forge',
    name: 'Pocket Forge',
    tagline: 'Build small games on the train',
    description:
      'A visual scripting game engine that exports a playable build to TestFlight. No Mac required.',
    category: 'games',
    tech: ['swift', 'uikit', 'revenuecat'],
    founder: 'kwesiboateng',
    mrr: 3_640,
    monthlyGrowth: 0.126,
    provider: 'revenuecat',
    ageMonths: 6,
  },
  {
    slug: 'receiptless',
    name: 'Receiptless',
    tagline: 'Expenses filed before you leave the restaurant',
    description:
      'Snap the receipt, and Receiptless reads it, matches it to the card charge, and files it against the right project.',
    category: 'finance',
    tech: ['swiftui', 'supabase', 'revenuecat'],
    founder: 'marasolberg',
    mrr: 26_900,
    monthlyGrowth: 0.067,
    provider: 'revenuecat',
    extraProvider: 'stripe',
    ageMonths: 18,
  },
  {
    slug: 'brushwork',
    name: 'Brushwork',
    tagline: 'Procreate brushes, organised',
    description:
      'Import, tag, and preview thousands of brushes, then push a set to the iPad you are actually drawing on.',
    category: 'photo-video',
    tech: ['swiftui', 'cloudkit', 'storekit-2'],
    founder: 'inesmoreau',
    mrr: 6_410,
    monthlyGrowth: 0.018,
    provider: 'app_store_connect',
    ageMonths: 25,
  },
  {
    slug: 'signalcheck',
    name: 'Signalcheck',
    tagline: 'Know why your app is slow before your users do',
    description:
      'Drop-in SDK plus an iOS dashboard for cold start, hitch rate, and crash-free sessions. Alerts arrive as a Live Activity.',
    category: 'developer-tools',
    tech: ['swift', 'swiftui', 'supabase', 'revenuecat'],
    founder: 'haruna-sato',
    mrr: 39_500,
    monthlyGrowth: 0.101,
    provider: 'revenuecat',
    extraProvider: 'stripe',
    ageMonths: 16,
  },
]

/** Deterministic PRNG so a reseed produces the same charts. */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0xffffffff
  }
}

function hashString(value: string) {
  let hash = 2_166_136_261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

const HISTORY_DAYS = 180

/**
 * Walks MRR backwards from today at the app's monthly growth rate, with weekly
 * seasonality and noise, so the charts look like real subscription revenue
 * rather than a smooth exponential.
 */
function buildHistory(app: SeedApp) {
  const random = makeRandom(hashString(app.slug))
  const dailyGrowth = Math.pow(1 + app.monthlyGrowth, 1 / 30)
  const days = Math.min(HISTORY_DAYS, app.ageMonths * 30)

  const series: { date: Date; mrrCents: number }[] = []
  let value = app.mrr * 100

  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - daysAgo)

    const noise = 1 + (random() - 0.5) * 0.012
    series.push({ date, mrrCents: Math.max(0, Math.round(value * noise)) })
    value /= dailyGrowth
  }

  return series.reverse()
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
  if (!isLocal && !process.argv.includes('--force')) {
    throw new Error(
      'Refusing to seed a non-local database. This inserts fictional revenue that must ' +
        'never reach a live site. Re-run with --force if you are certain.',
    )
  }

  const sql = postgres(url, { max: 1, prepare: false })

  try {
    console.log('Seeding categories and tech tags…')
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

    for (const [slug, name, kind] of TECH_TAGS) {
      await sql`
        insert into tech_stack_tags (slug, name, kind) values (${slug}, ${name}, ${kind})
        on conflict (slug) do update set name = excluded.name, kind = excluded.kind
      `
    }

    console.log('Seeding founders…')
    const founderIds = new Map<string, string>()
    for (const [handle, name] of FOUNDERS) {
      const id = randomUUID()
      await sql`insert into auth.users (id, email) values (${id}, ${handle + '@example.com'})
                on conflict (email) do nothing`
      const [user] = await sql<{ id: string }[]>`
        select id from auth.users where email = ${handle + '@example.com'}`
      await sql`
        insert into profiles (id, handle, name, bio)
        values (${user.id}, ${handle}, ${name}, ${'Building iOS apps. Sample account.'})
        on conflict (id) do update set handle = excluded.handle, name = excluded.name
      `
      founderIds.set(handle, user.id)
    }

    console.log(`Seeding ${APPS.length} apps and ${HISTORY_DAYS} days of revenue…`)
    for (const app of APPS) {
      const [category] = await sql<{ id: string }[]>`
        select id from categories where slug = ${app.category}`

      const launchedAt = new Date()
      launchedAt.setUTCMonth(launchedAt.getUTCMonth() - app.ageMonths)

      const [row] = await sql<{ id: string }[]>`
        insert into apps (
          slug, name, tagline, description, app_store_id, bundle_id, app_store_url,
          founder_id, category_id, status, is_verified, verified_at, launched_at
        ) values (
          ${app.slug}, ${app.name}, ${app.tagline}, ${app.description},
          ${String(900_000_000 + (hashString(app.slug) % 99_000_000))},
          ${'com.example.' + app.slug.replace(/-/g, '')},
          ${null},
          ${founderIds.get(app.founder)!}, ${category.id},
          'live', true, now(), ${launchedAt.toISOString().slice(0, 10)}
        )
        on conflict (slug) do update set
          tagline = excluded.tagline, description = excluded.description
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
      const providers: SeedApp['provider'][] = [app.provider]
      if (app.extraProvider) providers.push(app.extraProvider)

      await sql`delete from revenue_snapshots where app_id = ${row.id}`
      for (const provider of providers) {
        // A second provider (web checkout) contributes a slice on top of IAP.
        const share = provider === app.provider ? (app.extraProvider ? 0.82 : 1) : 0.18
        const rows = history.map((point) => ({
          app_id: row.id,
          provider,
          captured_on: point.date.toISOString().slice(0, 10),
          captured_at: point.date.toISOString(),
          mrr_cents: Math.round(point.mrrCents * share),
          active_subscriptions: Math.round((point.mrrCents * share) / 100 / 8.5),
          currency: 'USD',
        }))

        for (let i = 0; i < rows.length; i += 500) {
          await sql`insert into revenue_snapshots ${sql(rows.slice(i, i + 500))}`
        }

        await sql`
          insert into revenue_connections (app_id, provider, status, encrypted_credentials, account_label, last_synced_at)
          values (${row.id}, ${provider}, 'active', ${encryptCredentials({ sample: true })}, ${'Sample connection'}, now())
          on conflict (app_id, provider) do update set
            encrypted_credentials = excluded.encrypted_credentials,
            status = 'active',
            last_error = null,
            consecutive_failures = 0,
            last_synced_at = now()
        `
      }
    }

    console.log('Rebuilding app metrics…')
    const { recomputeAppMetrics } = await import('../src/lib/metrics')
    const appRows = await sql<{ id: string }[]>`select id from apps`
    for (const app of appRows) await recomputeAppMetrics(app.id)

    const [{ count }] = await sql<{ count: string }[]>`select count(*) from revenue_snapshots`
    console.log(`Done. ${appRows.length} apps, ${count} revenue snapshots.`)
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
