# TrustMRR · iOS

A directory of App Store apps whose revenue is read directly from their payment
provider, never typed in by hand. Modelled on [trustmrr.com](https://trustmrr.com),
scoped entirely to iOS.

Every listing is an App Store app, so each one carries its real icon, rating,
category, and version from Apple's public catalogue alongside verified MRR.

## Stack

- **Next.js 15** (App Router, RSC) + TypeScript
- **Tailwind CSS v4** with a token system in `src/app/globals.css`
- **Prettier** (`npm run format`) with the Tailwind class-sorting plugin
- **Supabase** — Postgres, Auth (magic link + GitHub), RLS
- **Drizzle ORM** for queries and migrations
- **Vercel** for hosting and cron

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in the values, see below
npm run db:setup               # migrate, apply policies, seed sample data
npm run dev
```

`db:setup` runs three steps you can also run individually:

| Command               | What it does                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts`                                                         |
| `npm run db:migrate`  | Apply migrations in `supabase/migrations`                                                            |
| `npm run db:policies` | Apply `supabase/policies.sql` — RLS, triggers, auth wiring. Idempotent; re-run after every migration |
| `npm run db:seed`     | Insert sample apps and 180 days of revenue history                                                   |

### Environment

See `.env.example` for the full list. Two are worth calling out:

- **`CREDENTIALS_ENCRYPTION_KEY`** — 32 random bytes, base64. Encrypts every
  stored provider credential. **Rotating it makes all of them unreadable**, and
  founders must reconnect.
- **`CRON_SECRET`** — shared secret for the sync endpoints. Without it they'd be
  a public button for hammering provider APIs.

Generate both with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Local database without Supabase

The app runs against plain Postgres for development — `supabase/policies.sql`
creates a minimal `auth` schema shim when it doesn't find Supabase's. Auth
itself still needs a real Supabase project; everything public works without one.

```bash
createdb trustmrr_dev
# DATABASE_URL=postgresql://you@localhost:5432/trustmrr_dev
```

## Design system

Dark only, monospace throughout — the interface is meant to read like a
terminal, and tabular figures let every revenue column line up across rows.

Tokens live in `src/app/globals.css` and are exposed to Tailwind through
`@theme inline`. Use the token classes, never raw hex.

| Token                   | Class                     | Used for                          |
| ----------------------- | ------------------------- | --------------------------------- |
| `--bg` `#0a0a0a`        | `bg-bg`                   | Page background                   |
| `--surface` `#141414`   | `bg-surface`              | Cards, tables, panels             |
| `--surface-2` `#1c1c1c` | `bg-surface-2`            | Hover and inset fills             |
| `--border` `#262626`    | `border-border`           | Every divider and card edge       |
| `--fg` `#ededed`        | `text-fg`                 | Primary text and figures          |
| `--fg-muted` `#8f8f8f`  | `text-muted`              | Secondary text                    |
| `--fg-dim` `#666`       | `text-dim`                | Labels, timestamps                |
| `--accent` `#fafafa`    | `bg-accent`               | The one primary action per view   |
| `--green` / `--red`     | `text-green` / `text-red` | Direction of change, nothing else |
| `--blue`                | `text-blue`               | Verified state and links          |
| `--gold`                | `text-gold`               | Status flags                      |

Colour is rationed on purpose: green always means "MRR is up on 30 days ago",
so an app's own icon is the only other saturated thing in a row.

Two utility classes carry most of the typography:

- `.display` — headline weight and tracking. Monospace at display size needs
  tighter tracking than its default.
- `.label` — the 10px uppercase key that sits above every figure on the site.

Components worth reusing before writing new ones: `Stat` (`components/ui/card`)
for a label/value pair, `AppRow` + `AppRowHeader` for any table of apps,
`AppCard` + `AppRail` for a horizontal card rail.

## How verification works

1. A founder pastes an App Store link. We fetch the public listing from Apple's
   iTunes lookup API and pre-fill the submission.
2. They connect a **read-only** provider credential. We make one live call to
   confirm it works, and **only store it if that call succeeds**.
3. The credential is encrypted with AES-256-GCM before it touches the database.
4. An hourly cron re-reads every active connection and appends a daily snapshot.
5. `app_metrics` is rebuilt from those snapshots — every leaderboard and card
   reads that rollup, never the raw history.

An app is a private draft until a provider verifies it. Verification is the only
thing that publishes a listing.

### Providers

| Provider          | Credential                                                              | Notes                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| RevenueCat        | V2 secret key scoped to `charts_metrics:overview:read`, plus project ID | Primary path. 25 req/min per key                                                                                                        |
| App Store Connect | Issuer ID, key ID, `.p8`, vendor number                                 | Reports lag one day; UI shows a "data as of" date                                                                                       |
| Stripe            | Restricted key with read on Subscriptions                               | For apps that also bill on the web                                                                                                      |
| Superwall         | —                                                                       | **Not supported.** Superwall issues public SDK keys only and publishes no metrics API, so there is no way to verify a figure through it |

Multiple providers on one app are summed once per day, never double-counted.

## Payments

Polar is the merchant of record for the two paid products:

| Product       | Billing  | Grants                                                                                  |
| ------------- | -------- | --------------------------------------------------------------------------------------- |
| Dofollow link | One-time | `apps.website_dofollow`, so the listing's website link drops `rel="nofollow"`           |
| Sponsor slot  | Monthly  | A rotating slot in the side rails, using the app's own icon and tagline as the creative |

Both are bought from the app's edit screen, which is the only place that knows
which listing a purchase belongs to.

**Nothing is granted by the browser.** The success URL proves nothing — anyone
can type it — so `/api/webhooks/polar` is the only code that promotes a purchase
to `active`. It verifies Polar's signature, and every handler is idempotent
because webhooks are delivered at least once. `websiteDofollow` is deliberately
absent from `updateAppDetails`, so no founder-facing form can set it.

Leave `POLAR_ACCESS_TOKEN` or a product id unset and that product simply is not
offered — the UI says so rather than showing a button that throws.

To set it up:

1. Create the two products in Polar and copy their ids into `.env.local`.
2. Add a webhook endpoint pointing at `https://your-host/api/webhooks/polar`,
   subscribed to `order.paid`, `order.refunded`, `subscription.active`,
   `subscription.uncanceled`, and `subscription.revoked`.
3. Copy the signing secret into `POLAR_WEBHOOK_SECRET`.
4. Keep `POLAR_SERVER=sandbox` until you have tested end to end. Sandbox is a
   separate deployment — its tokens and product ids do not work in production.

### When a webhook is missed

A webhook is a delivery, not a guarantee. If the endpoint is missing,
misconfigured, or down when an order is paid, Polar has nowhere to deliver to —
and it only retries endpoints that existed at the time, so that payment is
stranded: charged, but never granted.

`npm run polar:reconcile` asks Polar the question the webhook would have
answered. For every purchase still `pending` it looks for a paid order against
that checkout, and grants what was bought:

```bash
npm run polar:reconcile          # report what would change
npm run polar:reconcile -- --fix # apply it
```

It calls the same `activatePurchase` the webhook does rather than reimplementing
the grant, so the two cannot drift, and that function is idempotent — running it
repeatedly, or alongside a webhook that later arrives, is safe. Worth running
after any webhook outage, and worth checking if a founder reports paying for
something they did not receive.

> **Payouts.** Polar settles to sellers over Stripe Connect Express and does not
> list Georgia among its supported seller countries. Checkout and webhooks work
> regardless; receiving the money needs an entity Polar supports.

## Security model

`revenue_connections` holds provider credentials and **has RLS enabled with no
policy at all**. Anon and authenticated roles cannot read, insert, or update a
single row — including the founders who own them. Only server code holding the
service-role key can reach it. Do not add a policy to that table.

`purchases` is locked down the same way, for the same reason: a client that
could write a row could grant itself a paid upgrade for free.

Verify this at any time:

```sql
set role anon;
select count(*) from revenue_connections;  -- must be 0
select count(*) from purchases;            -- must be 0
```

## Testing

```bash
npm test          # unit tests: report parsers, MRR normalisation, crypto
npm run typecheck
npm run lint
npm run build
```

Manual end-to-end check:

1. Sign in, submit a real App Store URL, confirm the icon and metadata populate.
2. Connect a RevenueCat key; confirm the app flips to live and a snapshot lands.
3. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-revenue`
   twice — the snapshot count must not change (it upserts per day).
4. Enter a bad key; confirm a readable error and that existing snapshots survive.

## Layout

```
src/
  app/                    routes; (public) pages use ISR, dashboard is dynamic
  components/             UI — squircle icons, sparklines, sync tape
  db/                     Drizzle schema and client
  lib/
    appstore/             iTunes lookup client and URL parsing
    providers/            one adapter per revenue provider, common interface
    crypto/               credential encryption (server-only)
    data/                 queries and mutations
    sync.ts               the hourly job
supabase/
  migrations/             generated by drizzle-kit
  policies.sql            RLS, triggers, auth wiring — hand-written
scripts/                  seed and policy-application CLIs
```

## Deploying

1. Create a Supabase project; set the `NEXT_PUBLIC_SUPABASE_*`, service role,
   and `DATABASE_URL` (transaction pooler) variables in Vercel.
2. Run `npm run db:migrate && npm run db:policies` against it.
3. Set `CREDENTIALS_ENCRYPTION_KEY` and `CRON_SECRET`.
4. Deploy. `vercel.json` registers the hourly revenue sync and the daily App
   Store metadata refresh.

Do **not** run `npm run db:seed` against production — it inserts fictional
revenue and refuses non-local databases unless forced.

## Not built yet

The marketplace (buy/sell listings, asking price, buyer inquiries), the activity
feed, co-founder matching, and the admin review queue. The schema reserves
nullable columns on `apps` for the marketplace phase.
