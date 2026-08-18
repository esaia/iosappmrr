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
