# iosAppMRR.com

A directory of App Store apps whose revenue is read directly from their payment
provider, never typed in by hand. Modelled on [trustmrr.com](https://trustmrr.com),
scoped entirely to iOS.

Every listing is an App Store app, so each one carries its real icon, rating,
category, and version from Apple's public catalogue alongside verified MRR.

## Stack

- **Next.js 15** (App Router, RSC) + TypeScript
- **Tailwind CSS v4** with a token system in `src/app/globals.css`
- **Prettier** (`npm run format`) with the Tailwind class-sorting plugin
- **Supabase** — Postgres, Auth (X + Google OAuth), RLS
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
4. A daily cron re-reads every active connection and appends a snapshot for that
   day.
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

## Listing quality

Every profile carries a 0–100 score for how well its App Store listing is built,
beside the revenue it earns. It is computed in `src/lib/appstore/aso.ts` from the
same daily lookup that refreshes the icon and rating, and stored on
`app_store_metadata` — no App Store Connect key, so the identical score can be
run for any app in the store.

| Signal          | Weight | Measured against                                                     |
| --------------- | -----: | -------------------------------------------------------------------- |
| Ratings         |     25 | Average over a 3.5★ floor, plus volume on a log scale                |
| Title           |     20 | Use of the 30-character budget, and keywords past the brand name     |
| Description     |     15 | Length, the ~170 characters shown before "more", scannable structure |
| Screenshots     |     15 | Count against the 5 that fill the gallery, out of Apple's cap of 10  |
| Update cadence  |     15 | Days since the last release; full marks inside 30                    |
| Icon & category |     10 | Icon present, primary genre set, second genre claimed                |

> **It is listing quality, not rank.** The subtitle, the 100-character keyword
> field, impressions, and install conversion are what actually decide search
> placement, and Apple publishes none of them. The panel says so on the page;
> calling this an "ASO rank" would be the same unverifiable claim about
> marketing that a typed-in MRR figure is about revenue.

The score appears once the metadata sync has run. `npm run aso` prints it for
every live app, and `npm run aso -- --refresh` re-reads Apple first rather than
waiting for the 04:30 cron.

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

## Admin

Everything at `/admin` requires `profiles.role = 'admin'`. Roles are changed
only from the command line — there is no user-management screen, deliberately,
because handing out admin is rare and not worth a button that can be clicked by
mistake:

```bash
npm run role -- <handle> admin      # promote
npm run role -- <handle> founder    # demote
npm run role                        # usage, plus a list of handles and roles
```

The change takes effect immediately: the role is read from the database on every
request rather than baked into the session, so there is no need to sign in again.

The section is five screens:

| Screen        | What it does                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**  | Counts, plus the two failures that are invisible on the public site: checkouts that never settled, and revenue connections that have stopped refreshing.                                 |
| **Apps**      | Every app including drafts and hidden ones. Search by name, slug, or founder handle. Turn a sponsor slot on or off per app, gift or withdraw a dofollow link, publish or hide a listing. |
| **Purchases** | The full ledger — paid and gifted, pending and revoked. Settle a stuck checkout or revoke a purchase after a refund.                                                                     |
| **Settings**  | How many sponsor slots exist to sell. Everything priced or worded stays in code, and the screen says which file.                                                                         |
| **Activity**  | The audit log of everything done from these screens.                                                                                                                                     |

### Verification is not an admin control

`apps.is_verified` is owned by the provider-connection flow: set when a founder
connects a source, cleared when they disconnect the last one. The admin screens
show it and never write it.

That is not squeamishness about a button. The public "Verified" badge is rendered
from the providers on `app_metrics`, not from this flag, so an admin toggle would
not have removed the badge it appeared to remove — it would only have changed the
`/stats` totals, silently. To take a listing down, use **Hide**, which does
exactly what it says.

### Gifts

A gift is written as a `purchases` row with `source = 'admin'`, `amount_cents = 0`,
and no checkout id — not as a flipped flag on the app. So a gifted upgrade and a
bought one grant exactly the same thing through the same code, expire the same
way, and are withdrawn by the same path; `source` is the only thing that
separates them, which is what keeps the revenue figures honest.

Gifting a sponsor slot respects the slot cap, exactly as checkout does. If the
rails are full, raise the count in **Settings** first — overselling would mean
every paying sponsor gets less rotation than they bought.

### A payment always beats a gift, and admins cannot undo one

Three rules, because a sponsor slot is a subscription and someone is paying for
it:

**An admin cannot switch off anything paid for.** Not the sponsor slot, not the
dofollow link. Both end when Polar says they end — `subscription.revoked` and
`order.refunded` already withdraw them without anyone clicking anything — so the
button would exist only to make it possible to take away something a founder is
paying for. The Apps screen says who is paying instead of offering a control.
`revokeActivePurchasesForApp` takes a `source` filter and the admin screens pass
`'admin'`, so the restriction holds in the data layer rather than only in the UI.

**A gift can only be given where nothing is already active.** Gifting on top of a
paid subscription is refused; there is nothing to give.

**A founder can pay for a slot they were gifted, and the payment takes over.**
Checkout treats an existing gift as an upgrade rather than a duplicate, and skips
the slot-cap check because the gift already occupies a slot. When the webhook
confirms payment, `activatePurchase` marks the gift `superseded` — not `revoked`,
since nothing was withdrawn; the founder started paying for what they had been
given. Without that the app would hold two live sponsor rows, appear in the rails
twice, and consume two of the slots on sale.

A superseded gift does not come back if the subscription later lapses. The slot
then ends the way any sponsor's does, and an admin can gift again deliberately —
a gift that silently resurrected months later would be impossible to reason about.

Slot counting and the rails both count distinct apps rather than purchase rows,
so even the brief window where a gift and its replacement are both active cannot
show one sponsor twice or report the rails as fuller than they are.

### Sponsor slots

The number of slots on sale lives in `site_settings`, not in code, so it changes
without a deploy. `src/lib/ads.ts` holds only the value a fresh database starts
with; server code must read `getSponsorSlots()` instead. Lowering the count never
evicts a booked sponsor — it stops new checkouts and lets the number fall back as
slots lapse.

### Audit log

Every change made from these screens appends a row to `admin_actions`, with the
actor's handle snapshotted rather than joined so the entry still reads correctly
after an account is renamed or deleted. The log records before/after values,
because reversing a mistaken change by hand needs the exact previous value. There
is no way to edit or delete an entry from the site — that is the only thing that
makes it worth reading. `npm run role` writes to it too, as `@cli`.

## Security model

`revenue_connections` holds provider credentials and **has RLS enabled with no
policy at all**. Anon and authenticated roles cannot read, insert, or update a
single row — including the founders who own them. Only server code holding the
service-role key can reach it. Do not add a policy to that table.

`purchases`, `site_settings`, and `admin_actions` are locked down the same way,
for the same reason: a client that could write to them could grant itself a paid
upgrade for free, put more inventory on sale, or erase the record of having done
either.

RLS decides which **rows** a client may write, not which **columns** — and
`profiles_update_own` / `apps_update_own` both grant a signed-in user write
access to their own row. Those rows hold the fields the site's claims rest on:
`profiles.role`, and `apps.is_verified` / `apps.website_dofollow` / `apps.status`
/ `apps.founder_id`. Without a further guard, anyone with the anon key and a
session could make themselves an admin, award their own app a verified badge, or
take the paid dofollow link for free — from a browser console, with no server
code involved.

`supabase/policies.sql` closes that two ways: column-level `revoke update` for
the `anon` and `authenticated` roles, and a `deny_client_column_change` trigger
that raises if a guarded column changes while `current_user` is one of those
roles. Server code connects as the database owner and is deliberately unaffected
— it checks the caller's admin role itself before granting anything.

Verify all of it at any time:

```sql
set role anon;
select count(*) from revenue_connections;  -- must be 0
select count(*) from purchases;            -- must be 0
select count(*) from site_settings;        -- must be 0
select count(*) from admin_actions;        -- must be 0

set role authenticated;
select set_config('request.jwt.claim.sub', '<a real profile id>', false);
update profiles set role = 'admin' where id = '<that id>';        -- must raise
update apps set is_verified = true where founder_id = '<that id>'; -- must raise
update apps set tagline = 'still editable' where founder_id = '<that id>'; -- must succeed
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
    sync.ts               the daily sync job
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
4. Deploy. `vercel.json` registers the daily revenue sync and the daily App
   Store metadata refresh.

> **Cron cadence is a plan limit, not a design choice.** Vercel's Hobby plan
> only permits daily cron jobs and rejects a deployment whose schedule runs more
> often, so both jobs are daily and the site says "refreshed daily" everywhere.
>
> Revenue genuinely wants to be read hourly. Two ways to get there: upgrade to
> Vercel Pro and restore `0 * * * *` in `vercel.json`, or leave the plan alone
> and call the endpoints from an external scheduler — they are plain authorised
> `GET`s, so anything that can send a header works:
>
> ```
> curl -H "Authorization: Bearer $CRON_SECRET" \
>   https://your-domain/api/cron/sync-revenue
> ```
>
> Whichever you pick, the copy has to move with it. "Refreshed hourly" over a
> daily job is exactly the kind of unverifiable claim this site exists to
> replace.

Do **not** run `npm run db:seed` against production — it inserts fictional
revenue and refuses non-local databases unless forced.

## Not built yet

The marketplace (buy/sell listings, asking price, buyer inquiries), the activity
feed, and co-founder matching. The schema reserves nullable columns on `apps` for
the marketplace phase.

There is no submission review queue: an app goes live when a provider connection
succeeds, not when someone approves it. `/admin` can hide a listing after the
fact, which is the moderation the site actually needs.
