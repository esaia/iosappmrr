import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  real,
  jsonb,
  customType,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'

import type { AsoSignal } from '@/lib/appstore/aso'

/** Postgres `bytea`, used for AES-256-GCM ciphertext. Never exposed to the client. */
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType: () => 'bytea',
})

export const appStatus = pgEnum('app_status', ['draft', 'pending', 'live', 'hidden'])
export const providerId = pgEnum('provider_id', [
  'revenuecat',
  'app_store_connect',
  'superwall',
  'stripe',
])
export const connectionStatus = pgEnum('connection_status', [
  'pending',
  'active',
  'error',
  'revoked',
])
export const userRole = pgEnum('user_role', ['founder', 'admin'])
export const audienceType = pgEnum('audience_type', ['B2C', 'B2B', 'B2B2C'])

/* -------------------------------------------------------------------------- */
/*                                  Profiles                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `auth.users`. The foreign key and the insert trigger that populates
 * this table live in `supabase/policies.sql` — Drizzle does not manage the
 * `auth` schema.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    handle: text('handle').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    website: text('website'),
    twitter: text('twitter'),

    /**
     * Follower count, read once at sign-in with the founder's own X token.
     * Null when X was not used to sign in, or the call was not permitted.
     */
    twitterFollowers: integer('twitter_followers'),
    twitterSyncedAt: timestamp('twitter_synced_at', { withTimezone: true }),

    role: userRole('role').notNull().default('founder'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('profiles_handle_key').on(t.handle)],
)

/* -------------------------------------------------------------------------- */
/*                            Taxonomy & tech stack                            */
/* -------------------------------------------------------------------------- */

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** App Store primary genre this maps to, when there is a clean equivalent. */
    appStoreGenre: text('app_store_genre'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('categories_slug_key').on(t.slug)],
)

export const techStackTags = pgTable(
  'tech_stack_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** `language` | `framework` | `backend` | `monetization` | `tooling` */
    kind: text('kind').notNull().default('tooling'),
  },
  (t) => [uniqueIndex('tech_stack_tags_slug_key').on(t.slug)],
)

/* -------------------------------------------------------------------------- */
/*                                    Apps                                     */
/* -------------------------------------------------------------------------- */

export const apps = pgTable(
  'apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline'),
    description: text('description'),

    /** Numeric Apple ID from the App Store URL, e.g. 6448311069. */
    appStoreId: text('app_store_id').notNull(),
    bundleId: text('bundle_id'),
    appStoreUrl: text('app_store_url'),

    founderId: uuid('founder_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    /**
     * Hides who owns the listing without hiding the listing. The revenue is
     * still provider-verified and the app still ranks — only the byline, the
     * avatar and the link to the founder's page are withheld, and the app is
     * left off their public founder page. Ownership itself is unchanged:
     * `founder_id` still points at them, which is what the dashboard, the
     * connection and every RLS policy run on.
     */
    isAnonymous: boolean('is_anonymous').notNull().default(false),

    status: appStatus('status').notNull().default('draft'),
    isVerified: boolean('is_verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    launchedAt: date('launched_at'),

    website: text('website'),
    twitter: text('twitter'),
    /**
     * Whether the website link is followed by search engines. Off by default:
     * an unpaid listing gets rel="nofollow", which is the honest default for a
     * link the site has not vouched for.
     */
    websiteDofollow: boolean('website_dofollow').notNull().default(false),
    // App insights. Founder-written, unlike revenue, which is provider-read.
    // Every field is optional; the profile hides whichever are blank.
    valueProposition: text('value_proposition'),
    problemSolved: text('problem_solved'),
    audience: text('audience'),
    audienceType: audienceType('audience_type'),
    marketTags: jsonb('market_tags').$type<string[]>().notNull().default([]),
    marketingChannels: jsonb('marketing_channels').$type<string[]>().notNull().default([]),
    additionalInfo: text('additional_info'),

    // Reserved for the marketplace phase. Unused in v1.
    forSale: boolean('for_sale').notNull().default(false),
    askingPriceCents: bigint('asking_price_cents', { mode: 'number' }),
    saleNotes: text('sale_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('apps_slug_key').on(t.slug),
    uniqueIndex('apps_app_store_id_key').on(t.appStoreId),
    index('apps_founder_idx').on(t.founderId),
    index('apps_status_idx').on(t.status),
    index('apps_category_idx').on(t.categoryId),
  ],
)

export const appTechStack = pgTable(
  'app_tech_stack',
  {
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => techStackTags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.appId, t.tagId] })],
)

/**
 * Refreshed daily from the public iTunes Lookup API. Everything here is
 * derived — never hand-edited — so the sync job can overwrite it wholesale.
 */
export const appStoreMetadata = pgTable('app_store_metadata', {
  appId: uuid('app_id')
    .primaryKey()
    .references(() => apps.id, { onDelete: 'cascade' }),
  trackName: text('track_name'),
  sellerName: text('seller_name'),
  iconUrl: text('icon_url'),
  screenshotUrls: jsonb('screenshot_urls').$type<string[]>().notNull().default([]),
  priceCents: integer('price_cents'),
  currency: text('currency'),
  hasInAppPurchases: boolean('has_in_app_purchases'),
  averageRating: real('average_rating'),
  ratingCount: integer('rating_count'),
  version: text('version'),
  primaryGenre: text('primary_genre'),
  genres: jsonb('genres').$type<string[]>().notNull().default([]),
  contentRating: text('content_rating'),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  updatedInStoreAt: timestamp('updated_in_store_at', { withTimezone: true }),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  supportedDevices: jsonb('supported_devices').$type<string[]>().notNull().default([]),
  minimumOsVersion: text('minimum_os_version'),

  /**
   * Ratings per star, 5★ first. Written by the review sync rather than the
   * lookup — Apple's catalogue API returns the average and the total, but only
   * the store page carries the breakdown behind them.
   */
  ratingHistogram: jsonb('rating_histogram').$type<number[]>(),

  /**
   * When the store page was last read for reviews. Set on every successful
   * read, including one that found no reviews — it records the attempt, not the
   * result, which is what lets the nightly sync skip an app it has already
   * scraped. A refetch is an explicit admin action.
   */
  reviewsFetchedAt: timestamp('reviews_fetched_at', { withTimezone: true }),

  /**
   * Listing-quality score, 0–100, recomputed from the same lookup that fills in
   * the rest of this row. Derived, so it is never hand-edited — see
   * `src/lib/appstore/aso.ts` for what the six signals measure.
   */
  asoScore: integer('aso_score'),
  asoSignals: jsonb('aso_signals').$type<AsoSignal[]>(),

  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The handful of customer reviews the App Store shows on a listing, refreshed
 * alongside the metadata above. Derived and replaced wholesale on every sync —
 * a review Apple stops showing should disappear here too.
 */
export const appStoreReviews = pgTable(
  'app_store_reviews',
  {
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    /** Apple's own review id, which is what makes the sync idempotent. */
    reviewId: text('review_id').notNull(),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body'),
    author: text('author'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // The primary key already leads with app_id, which is the only way this
  // table is ever read — a dozen rows per app, sorted in memory.
  (t) => [primaryKey({ columns: [t.appId, t.reviewId] })],
)

/* -------------------------------------------------------------------------- */
/*                         Revenue verification & data                         */
/* -------------------------------------------------------------------------- */

/**
 * Provider credentials. No RLS policy grants access to this table — it is only
 * ever read by server code holding the service-role key.
 */
export const revenueConnections = pgTable(
  'revenue_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    provider: providerId('provider').notNull(),
    status: connectionStatus('status').notNull().default('pending'),
    /** AES-256-GCM: iv (12B) || authTag (16B) || ciphertext. */
    encryptedCredentials: bytea('encrypted_credentials').notNull(),
    /** Non-secret hint shown in the dashboard, e.g. "proj1ab…" or "Vendor 8123456". */
    accountLabel: text('account_label'),
    /**
     * Which revenue account is behind this connection, as an opaque hash — see
     * `fingerprintAccount`. Not a secret and not reversible: it exists so the
     * unique index below can stop one account from backing several listings,
     * which is how one RevenueCat project would otherwise publish its MRR under
     * two different apps' names.
     *
     * Null on connections made before the check existed, and Postgres treats
     * nulls as distinct, so those rows neither collide nor need backfilling.
     */
    credentialFingerprint: text('credential_fingerprint'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('revenue_connections_app_provider_key').on(t.appId, t.provider),
    uniqueIndex('revenue_connections_fingerprint_key').on(t.credentialFingerprint),
    index('revenue_connections_sync_idx').on(t.status, t.lastSyncedAt),
  ],
)

/**
 * One row per app / provider / day. The sync job upserts on that key so a
 * re-run refreshes the day rather than appending duplicates.
 */
export const revenueSnapshots = pgTable(
  'revenue_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    provider: providerId('provider').notNull(),
    /** The day this measurement belongs to, in UTC. */
    capturedOn: date('captured_on').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),

    mrrCents: bigint('mrr_cents', { mode: 'number' }).notNull(),
    activeSubscriptions: integer('active_subscriptions'),
    activeTrials: integer('active_trials'),
    newCustomers28d: integer('new_customers_28d'),
    revenue28dCents: bigint('revenue_28d_cents', { mode: 'number' }),
    currency: text('currency').notNull().default('USD'),
  },
  (t) => [
    uniqueIndex('revenue_snapshots_app_provider_day_key').on(t.appId, t.provider, t.capturedOn),
    index('revenue_snapshots_app_day_idx').on(t.appId, t.capturedOn),
  ],
)

/**
 * Denormalised rollup that every leaderboard and card read hits, so those
 * queries never aggregate the full snapshot history. Rewritten by the sync job.
 */
export const appMetrics = pgTable(
  'app_metrics',
  {
    appId: uuid('app_id')
      .primaryKey()
      .references(() => apps.id, { onDelete: 'cascade' }),
    /** Sum across all active providers for the most recent day with data. */
    mrrCents: bigint('mrr_cents', { mode: 'number' }).notNull().default(0),
    arrCents: bigint('arr_cents', { mode: 'number' }).notNull().default(0),
    activeSubscriptions: integer('active_subscriptions'),
    /** Percent change vs. 30 days ago. Null until there is 30 days of history. */
    growth30d: real('growth_30d'),
    growth90d: real('growth_90d'),
    /** Up to 180 daily MRR values, oldest first, for the sparkline. */
    sparkline: jsonb('sparkline').$type<number[]>().notNull().default([]),
    dataAsOf: date('data_as_of'),
    providers: jsonb('providers').$type<string[]>().notNull().default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('app_metrics_mrr_idx').on(t.mrrCents),
    index('app_metrics_growth_idx').on(t.growth30d),
  ],
)

/* -------------------------------------------------------------------------- */
/*                                 Engagement                                  */
/* -------------------------------------------------------------------------- */

export const follows = pgTable(
  'follows',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.appId] })],
)

export const appViews = pgTable(
  'app_views',
  {
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),
    viewedOn: date('viewed_on').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.appId, t.viewedOn] })],
)

/* -------------------------------------------------------------------------- */
/*                                  Payments                                   */
/* -------------------------------------------------------------------------- */

/** What was bought. Each value maps to one Polar product. */
export const purchaseKind = pgEnum('purchase_kind', ['dofollow', 'sponsor'])

/**
 * `pending` is written when the checkout is created, before any money moves.
 * Only the webhook promotes a row to `active` — the browser coming back from a
 * success URL proves nothing, since anyone can navigate to it.
 *
 * `superseded` is a gift that a real payment replaced. It is not `revoked`:
 * nothing was withdrawn and nobody lost anything, the founder simply started
 * paying for what they had been given. Recording that as a revocation would
 * make the ledger read as if a benefit had been taken away.
 */
export const purchaseStatus = pgEnum('purchase_status', [
  'pending',
  'active',
  'revoked',
  'superseded',
])

/**
 * Where the entitlement came from.
 *
 * `admin` covers the two cases Polar cannot: a gift, and a repair after a
 * webhook that never arrived. Recording it on the row rather than inferring it
 * from a null checkout id means the books stay readable — a gifted slot and a
 * paid one grant exactly the same thing, but only one of them is revenue.
 */
export const purchaseSource = pgEnum('purchase_source', ['polar', 'admin'])

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: purchaseKind('kind').notNull(),
    status: purchaseStatus('status').notNull().default('pending'),
    source: purchaseSource('source').notNull().default('polar'),

    /** Who paid. Kept even if the app is deleted, so refunds can be traced. */
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),

    /**
     * Polar's checkout id. Unique because it is the idempotency key: webhooks
     * are delivered at least once, and a retry must update this row rather than
     * grant the benefit twice.
     *
     * Null for an admin grant, which never went through a checkout. Postgres
     * treats nulls as distinct in a unique index, so any number of grants can
     * coexist without colliding.
     */
    polarCheckoutId: text('polar_checkout_id'),
    polarOrderId: text('polar_order_id'),
    /** Set for `sponsor` only — dofollow is a one-time charge. */
    polarSubscriptionId: text('polar_subscription_id'),

    amountCents: bigint('amount_cents', { mode: 'number' }),
    currency: text('currency'),

    /**
     * When a sponsor's paid period lapses. Null for dofollow, which does not
     * expire. The rails read this so a cancelled sponsor drops off on time
     * without a nightly job.
     */
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

    /**
     * Set when a sponsor has turned off auto-renew but the period they paid
     * for has not run out. Display only — the entitlement is still live, and
     * `status` stays `active` until Polar says the access has actually ended.
     * Without it the account screen cannot tell a slot that renews from one
     * that is winding down, and both read as "Renews".
     */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    /**
     * The founder has switched off what they hold, without giving it up.
     *
     * Not the same as revoked: they still own it, a sponsor slot is still
     * theirs and still counted against the cap, and a paid one is still being
     * billed. It simply stops being shown — the rails skip it and the website
     * link goes back to nofollow — until they switch it on again. A gift can be
     * hidden the same way, because the reason to hide is about the app, not
     * about who paid.
     */
    hidden: boolean('hidden').notNull().default(false),

    /** The admin who granted this, for `source = 'admin'` rows. */
    grantedBy: uuid('granted_by').references(() => profiles.id, { onDelete: 'set null' }),
    /** Why it was granted or revoked by hand. Free text, admin-facing only. */
    note: text('note'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('purchases_polar_checkout_key').on(t.polarCheckoutId),
    uniqueIndex('purchases_polar_subscription_key').on(t.polarSubscriptionId),
    index('purchases_app_kind_idx').on(t.appId, t.kind, t.status),
    index('purchases_status_idx').on(t.status),
  ],
)

/* -------------------------------------------------------------------------- */
/*                              Vibecode verdicts                              */
/* -------------------------------------------------------------------------- */

/**
 * How hard the app would be to rebuild with AI coding tools.
 *
 * Three values rather than a score, because a number invites false precision:
 * nobody can say an app is 68% rebuildable, and a reader would treat the
 * figure as measured rather than guessed.
 */
export const vibecodeVerdict = pgEnum('vibecode_verdict', ['yes', 'kinda', 'not_really'])

/**
 * A model-written assessment of an app's rebuild difficulty, cached per app.
 *
 * Written once and read on every page view. The generation is deliberately not
 * on the render path: it costs money, takes seconds, and the answer does not
 * change between two readers. Nothing here is derived from revenue figures the
 * founder connected — see `buildPrompt` for what the model is actually shown.
 *
 * Rows are editable by hand. The model drafts; a human can always overrule it,
 * which matters because the subject is someone's business.
 */
export const vibecodeVerdicts = pgTable(
  'vibecode_verdicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** One verdict per app. Regenerating overwrites rather than accumulating. */
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'cascade' }),

    verdict: vibecodeVerdict('verdict').notNull(),
    /** One line, shown beside the verdict chip. */
    headline: text('headline').notNull(),
    /** Two or three sentences of reasoning. */
    reasoning: text('reasoning').notNull(),

    /** What a competent vibecoder could reproduce in a weekend. */
    rebuildable: jsonb('rebuildable').$type<string[]>().notNull().default([]),
    /** What they could not — distribution, data, integrations, brand. */
    moat: jsonb('moat').$type<string[]>().notNull().default([]),

    /**
     * Which model and prompt produced this. Both change over time, and without
     * them there is no way to tell a stale verdict from a current one, or to
     * re-run only the rows written by a prompt that turned out to be bad.
     */
    model: text('model').notNull(),
    promptVersion: integer('prompt_version').notNull().default(1),

    /** Set when a human edits the row, so a backfill can skip it. */
    editedByHuman: boolean('edited_by_human').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('vibecode_verdicts_app_key').on(t.appId)],
)

/* -------------------------------------------------------------------------- */
/*                              Admin & settings                               */
/* -------------------------------------------------------------------------- */

/**
 * Operational knobs an admin can turn without a deploy.
 *
 * Deliberately a key/value table rather than a column per setting: these are
 * numbers a human adjusts a handful of times a year, and each new one would
 * otherwise cost a migration. Values that describe the *product* — prices,
 * copy, rotation speed — stay in code where they are reviewable; only
 * inventory that changes with demand lives here.
 *
 * Every key has a default in `src/lib/settings.ts`, so an empty table is a
 * working configuration rather than a broken one.
 */
export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * An append-only record of everything done from the admin screens.
 *
 * The admin role can hand out paid placements, hide listings, and promote other
 * admins. None of that leaves a trace anywhere else — a gifted dofollow link is
 * indistinguishable from a bought one once it is granted — so the log is the
 * only way to answer "who did this, and when".
 *
 * `actorHandle` is a snapshot rather than a join, so the entry still reads
 * correctly after the account behind it is renamed or deleted.
 */
export const adminActions = pgTable(
  'admin_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
    actorHandle: text('actor_handle').notNull(),

    /** Machine-readable verb, e.g. `grant_dofollow` or `set_role`. */
    action: text('action').notNull(),
    /** One line in plain English, written for whoever reads the log later. */
    summary: text('summary').notNull(),

    /** `app` | `profile` | `purchase` | `setting` */
    targetType: text('target_type'),
    targetId: text('target_id'),

    /** Before/after values, so a mistaken change can be reversed by hand. */
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('admin_actions_created_idx').on(t.createdAt),
    index('admin_actions_target_idx').on(t.targetType, t.targetId),
  ],
)
