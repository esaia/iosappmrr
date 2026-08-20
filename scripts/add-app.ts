import 'dotenv/config'
import postgres from 'postgres'
import { lookupApp, parseAppStoreId } from '../src/lib/appstore/lookup'
import { scoreListing } from '../src/lib/appstore/aso'
import { slugify } from '../src/lib/utils'
import { LISTING_LIMITS, clampText } from '../src/lib/listing'

/**
 * Puts a real App Store listing into a founder's account, for looking at pages
 * that need a real app on them.
 *
 * It is the submit flow with the form and the provider connection taken out: it
 * reads Apple's own metadata for the app, writes the listing and the metadata
 * row, and stops. The app lands as a draft with no revenue, because inventing
 * revenue is `db:simulate`'s job and it already does it properly.
 *
 *   npm run db:add-app -- <appStoreUrlOrId> --founder <handle>
 *   npm run db:add-app -- <appStoreUrlOrId> --founder <handle> --undo
 *
 * Everything it writes belongs to the founder named on the command line, so
 * `--undo` is a slug delete rather than a prefix sweep: this writes one row and
 * removes the same one.
 */

function flag(name: string) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? null : (process.argv[at + 1] ?? null)
}

/**
 * Apple's genre against our own categories.
 *
 * Ours are Apple's with the punctuation removed, so slugifying the genre lands
 * on the right row for almost everything. A miss leaves the listing
 * uncategorised rather than guessing — a wrong category is worse than none,
 * since the profile page uses it to pick the related apps.
 */
async function categoryFor(sql: postgres.Sql, genre: string | null) {
  if (!genre) return null
  const slug = slugify(genre.replace(/\s*&\s*/g, '-'))
  const [row] = await sql<{ id: string }[]>`select id from categories where slug = ${slug}`
  return row?.id ?? null
}

/** `uniqueSlug` in mutations.ts, which a script cannot import — it is server-only. */
async function uniqueSlug(sql: postgres.Sql, name: string) {
  const base = slugify(name) || 'app'
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const [taken] = await sql`select 1 from apps where slug = ${candidate}`
    if (!taken) return candidate
  }
  return `${base}-${Date.now()}`
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const input = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!input) throw new Error('Pass the App Store URL or id.')

  const appStoreId = parseAppStoreId(input)
  if (!appStoreId) throw new Error(`Could not read an App Store id out of "${input}".`)

  const handle = flag('founder')
  if (!handle) throw new Error('Pass the owner: --founder <handle>')

  const sql = postgres(url, { max: 1, prepare: false })

  try {
    const [founder] = await sql<{ id: string; name: string | null }[]>`
      select id, name from profiles where handle = ${handle}`
    if (!founder) throw new Error(`No profile with the handle "${handle}".`)

    const [existing] = await sql<{ id: string; slug: string; name: string }[]>`
      select id, slug, name from apps where app_store_id = ${appStoreId}`

    if (process.argv.includes('--undo')) {
      if (!existing) {
        console.log('Nothing to remove — that app is not listed.')
        return
      }
      // The metadata, snapshots, connections and metrics all cascade off the app.
      await sql`delete from apps where id = ${existing.id}`
      console.log(`Removed ${existing.name} (/apps/${existing.slug}).`)
      return
    }

    if (existing) {
      throw new Error(
        `Already listed as ${existing.name} at /apps/${existing.slug}. ` +
          `Remove it first with --undo.`,
      )
    }

    const store = await lookupApp(appStoreId)
    if (!store) throw new Error(`Apple has no app with the id ${appStoreId}.`)

    const slug = await uniqueSlug(sql, store.name)
    const categoryId = await categoryFor(sql, store.primaryGenre)

    /*
     * Apple's copy, cut to the lengths this site's own forms enforce.
     *
     * Not a formality. The database has no length on either column, so an
     * over-long value writes cleanly and only fails later — when the founder
     * opens the edit form, which validates on the way in and refuses to save a
     * listing they have not touched. A listing its owner cannot edit is worse
     * than a tagline with an ellipsis on it.
     *
     * The tagline is the description's opening line, which is where an App
     * Store listing puts its one-sentence pitch.
     */
    const opening = store.description?.split('\n').find((line) => line.trim()) ?? null
    const tagline = opening ? clampText(opening, LISTING_LIMITS.tagline) : null
    const description = store.description
      ? clampText(store.description, LISTING_LIMITS.description)
      : null

    const [app] = await sql<{ id: string }[]>`
      insert into apps (
        slug, name, tagline, description, app_store_id, bundle_id, app_store_url,
        founder_id, category_id, website, launched_at, status
      ) values (
        ${slug}, ${store.name}, ${tagline}, ${description}, ${appStoreId}, ${store.bundleId},
        ${store.appStoreUrl ?? `https://apps.apple.com/app/id${appStoreId}`},
        ${founder.id}, ${categoryId}, ${store.website},
        ${store.releasedAt?.toISOString().slice(0, 10) ?? null}, 'draft'
      )
      returning id`

    const aso = scoreListing(store)

    await sql`
      insert into app_store_metadata (
        app_id, track_name, seller_name, icon_url, screenshot_urls, price_cents,
        currency, has_in_app_purchases, average_rating, rating_count, version,
        primary_genre, genres, content_rating, released_at, updated_in_store_at,
        file_size_bytes, supported_devices, minimum_os_version, aso_score,
        aso_signals, fetched_at
      ) values (
        ${app.id}, ${store.name}, ${store.sellerName}, ${store.iconUrl},
        ${sql.json(store.screenshotUrls)}, ${store.priceCents}, ${store.currency},
        ${store.hasInAppPurchases}, ${store.averageRating}, ${store.ratingCount},
        ${store.version}, ${store.primaryGenre}, ${sql.json(store.genres)},
        ${store.contentRating}, ${store.releasedAt}, ${store.updatedInStoreAt},
        ${store.fileSizeBytes}, ${sql.json(store.supportedDevices)},
        ${store.minimumOsVersion}, ${aso.total}, ${sql.json(aso.signals)}, now()
      )`

    console.log(
      `Added ${store.name} to ${founder.name ?? handle}.\n` +
        `  id:   ${app.id}\n` +
        `  page: /apps/${slug}  (a draft — not visible until it has revenue)\n\n` +
        `Give it revenue with:\n` +
        `  npm run db:simulate -- ${app.id}\n\n` +
        `Remove it with:\n` +
        `  npm run db:add-app -- ${appStoreId} --founder ${handle} --undo`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
