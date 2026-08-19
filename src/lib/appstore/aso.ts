import type { AppStoreApp } from '@/lib/appstore/lookup'

/**
 * A listing-quality score built only from what Apple publishes, so it can be
 * computed for every app in the directory from the same lookup that fills in
 * the rest of the profile — no App Store Connect key, no scraping.
 *
 * What it deliberately does not claim to be: a rank prediction. Subtitle, the
 * 100-character keyword field, impressions and install conversion are the
 * numbers that decide search placement, and none of them are public. Every
 * threshold below comes from a store constraint rather than a preference.
 */

export type AsoSignalKey =
  'title' | 'ratings' | 'description' | 'screenshots' | 'freshness' | 'presentation'

export type AsoSignal = {
  key: AsoSignalKey
  label: string
  /** Points this signal contributes at full marks. The six sum to 100. */
  weight: number
  /** 0–1, before the weight is applied. */
  score: number
  /** One line of plain evidence for the score, shown under the label. */
  detail: string
}

export type AsoScore = {
  /** 0–100, rounded. */
  total: number
  signals: AsoSignal[]
}

export type AsoBand = 'strong' | 'fair' | 'weak'

/** Apple truncates the display name at 30 characters and indexes every word. */
const TITLE_LIMIT = 30

/** Words the store gets nothing from, and that eat the title budget. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'for', 'of', 'to', 'my', 'app', 'free'])

const clamp = (value: number) => Math.max(0, Math.min(1, value))

const daysSince = (date: Date | null, now: number) =>
  date ? (now - date.getTime()) / 86_400_000 : null

/**
 * A title that is only a brand word ranks for that brand word and nothing else.
 * Half the marks are for using the 30 characters, half for what those extra
 * characters actually say.
 */
function titleSignal(app: AppStoreApp): AsoSignal {
  const name = app.name
  const used = Math.min(name.length, TITLE_LIMIT)
  const budget = used / TITLE_LIMIT

  // Everything after the first separator is where descriptive keywords live:
  // "Habit Tracker - Habitix", "Daily Affirmations - Glow".
  const beyondBrand = name
    .split(/[-–—:|]/)
    .slice(1)
    .join(' ')
  const keywords = beyondBrand
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))

  const truncated = name.length > TITLE_LIMIT
  const score =
    clamp(budget * 0.5 + (Math.min(keywords.length, 3) / 3) * 0.5) * (truncated ? 0.8 : 1)

  return {
    key: 'title',
    label: 'Title',
    weight: 20,
    score,
    detail: truncated
      ? `${name.length}/${TITLE_LIMIT} characters — cut off in search results`
      : `${used}/${TITLE_LIMIT} characters, ${keywords.length} keyword${keywords.length === 1 ? '' : 's'} past the brand`,
  }
}

/**
 * The heaviest signal, because it moves both search placement and the decision
 * to tap. Average is measured against a 3.5★ floor, where conversion starts to
 * suffer; volume is logarithmic, since 100 → 1 000 ratings matters far more
 * than 10 000 → 11 000.
 */
function ratingSignal(app: AppStoreApp): AsoSignal {
  const average = app.averageRating ?? 0
  const count = app.ratingCount ?? 0

  const quality = clamp((average - 3.5) / 1.4)
  const volume = clamp(Math.log10(count + 1) / 4)

  return {
    key: 'ratings',
    label: 'Ratings',
    weight: 25,
    score: clamp(quality * 0.55 + volume * 0.45),
    detail: count
      ? `${average.toFixed(2)}★ from ${count.toLocaleString('en-US')} ratings`
      : 'No ratings yet',
  }
}

/**
 * Apple's cap is 4 000 characters, but only the first ~170 show before "more" —
 * so the opening sentence carries most of the weight a description can carry.
 */
function descriptionSignal(app: AppStoreApp): AsoSignal {
  const text = app.description?.trim() ?? ''

  if (!text) {
    return { key: 'description', label: 'Description', weight: 15, score: 0, detail: 'Missing' }
  }

  const length = clamp(text.length / 2500)
  const preview = text.slice(0, 170)
  const openingSentence = preview.split(/[.!?]/)[0] ?? ''
  const hook = clamp(openingSentence.length / 90)
  // A scannable body beats a wall of prose once the reader has tapped "more".
  const structured = /\n\s*[•\-–*]/.test(text) ? 1 : 0.7

  return {
    key: 'description',
    label: 'Description',
    weight: 15,
    score: clamp(length * 0.45 + hook * 0.35 + structured * 0.2),
    detail: `${text.length.toLocaleString('en-US')} characters, opens “${truncate(openingSentence || preview, 60)}”`,
  }
}

/**
 * Three show in search results and ten is the upload cap; below five the
 * gallery looks unfinished on a large iPhone.
 */
function screenshotSignal(app: AppStoreApp): AsoSignal {
  const count = app.screenshotUrls.length

  return {
    key: 'screenshots',
    label: 'Screenshots',
    weight: 15,
    score: clamp(count / 6),
    detail: count
      ? `${count} uploaded${count < 5 ? ' — under the 5 that fill the gallery' : ''}`
      : 'None uploaded',
  }
}

/**
 * Apple favours actively maintained apps, and a stale "Updated" date is the
 * first thing a cautious buyer checks. Full marks inside a month, nothing left
 * after nine.
 */
function freshnessSignal(app: AppStoreApp, now: number): AsoSignal {
  const age = daysSince(app.updatedInStoreAt, now)

  if (age === null) {
    return {
      key: 'freshness',
      label: 'Update cadence',
      weight: 15,
      score: 0,
      detail: 'No release date published',
    }
  }

  return {
    key: 'freshness',
    label: 'Update cadence',
    weight: 15,
    score: clamp(1 - (age - 30) / 240),
    detail: `${Math.round(age)} days since the last release`,
  }
}

/** The listing basics Apple will happily let an app ship without. */
function presentationSignal(app: AppStoreApp): AsoSignal {
  const hasIcon = Boolean(app.iconUrl)
  const hasGenre = Boolean(app.primaryGenre)
  // A second genre is a second browse surface the app appears on, for free.
  const hasSecondGenre = app.genres.length > 1

  const parts = [
    hasIcon ? 'icon' : 'no icon',
    hasGenre ? app.primaryGenre : 'no category',
    hasSecondGenre ? 'second category claimed' : 'one category only',
  ]

  return {
    key: 'presentation',
    label: 'Icon & category',
    weight: 10,
    score: (hasIcon ? 0.5 : 0) + (hasGenre ? 0.25 : 0) + (hasSecondGenre ? 0.25 : 0),
    detail: parts.join(' · '),
  }
}

/**
 * `now` is injectable so the update-cadence signal can be tested without
 * pinning the clock.
 */
export function scoreListing(app: AppStoreApp, now = Date.now()): AsoScore {
  const signals = [
    titleSignal(app),
    ratingSignal(app),
    descriptionSignal(app),
    screenshotSignal(app),
    freshnessSignal(app, now),
    presentationSignal(app),
  ]

  const total = signals.reduce((sum, signal) => sum + signal.score * signal.weight, 0)

  return { total: Math.round(total), signals }
}

/**
 * Bands rather than a bare number, so a founder reads "this listing is fine" or
 * "this needs work" without having to know what 68 means.
 */
export function asoBand(total: number): AsoBand {
  if (total >= 75) return 'strong'
  if (total >= 45) return 'fair'
  return 'weak'
}

export const ASO_BAND_LABEL: Record<AsoBand, string> = {
  strong: 'Strong',
  fair: 'Fair',
  weak: 'Needs work',
}

function truncate(text: string, limit: number) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean
}
