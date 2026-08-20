-- A connection that reports downloads instead of money, and the snapshots it
-- writes.
--
-- App Store Connect is the only source of installs, but most apps already have
-- their revenue coming from RevenueCat, and every daily total on the site sums
-- across providers. Connecting Apple on top of RevenueCat to get installs would
-- therefore have counted the same Apple subscriptions twice and roughly doubled
-- the app's MRR — so the money side of such a connection is switched off here
-- rather than left for each aggregate to guess at.
--
-- The flag is recorded in both places on purpose. On the connection it decides
-- which report the next sync reads; on the snapshot it records what that row
-- turned out to be. Reading the connection's flag when aggregating would have
-- been one column fewer and quietly wrong: a founder who switched an existing
-- App Store Connect connection to installs-only would have retroactively
-- deleted every MRR figure it had ever reported from a public chart.
--
-- Rows written this way carry mrr_cents = 0 and are filtered out of every
-- revenue aggregate. They are also not verification: a download is not a
-- dollar, and `apps.is_verified` stays where it was when one is connected or
-- dropped.

ALTER TABLE "revenue_connections"
  ADD COLUMN "installs_only" boolean NOT NULL DEFAULT false;

ALTER TABLE "revenue_snapshots"
  ADD COLUMN "installs_only" boolean NOT NULL DEFAULT false;
