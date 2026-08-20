-- A day's takings, alongside the trailing 28-day total already stored beside it.
--
-- `revenue_28d_cents` is what RevenueCat's overview endpoint returns, and being
-- a rolling window it can never be zero on a quiet day or spike on a busy one.
-- The chart's Revenue line was therefore a near-copy of the MRR line, which is
-- not what a revenue chart is for.
--
-- Nullable, and it will stay null for most apps: RevenueCat has no per-day
-- figure to give. App Store Connect does — Apple's SALES/SUMMARY report is
-- daily — but the sync reads the SUBSCRIPTION report today, so filling this for
-- real apps is a separate change. The chart hides any series whose days are all
-- null, so nothing is advertised that a provider cannot supply.
--
-- Written by hand: a generated diff prompts to disambiguate this from a rename
-- of `revenue_28d_cents`, and the two columns coexist.

ALTER TABLE "revenue_snapshots" ADD COLUMN "revenue_cents" bigint;
