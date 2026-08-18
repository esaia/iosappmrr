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
    // Startup insights. Founder-written, unlike revenue, which is provider-read.
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
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

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
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('revenue_connections_app_provider_key').on(t.appId, t.provider),
    index('revenue_connections_sync_idx').on(t.status, t.lastSyncedAt),
  ],
)

/**
 * One row per app / provider / day. The hourly job upserts on that key so a
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
 */
export const purchaseStatus = pgEnum('purchase_status', ['pending', 'active', 'revoked'])

export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: purchaseKind('kind').notNull(),
    status: purchaseStatus('status').notNull().default('pending'),

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
     */
    polarCheckoutId: text('polar_checkout_id').notNull(),
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
