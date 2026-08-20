-- Downloads on a day, beside the money taken on it.
--
-- Apple's SALES/SUMMARY report is per-day and carries units for every SKU in
-- the vendor account, so the same App Store Connect connection that reads
-- subscriptions can count first-time installs for the one app it is attached
-- to. No other provider here reads Apple's figures — RevenueCat and Stripe see
-- payments, and most people who install an app never pay for it — so this stays
-- null for them.
--
-- Nullable rather than defaulted to zero, and null on any day Apple published
-- no sales file: "nobody installed it" and "Apple has nothing for that day" are
-- different facts, and the chart draws a gap for the second.
--
-- Written by hand: a generated diff prompts to disambiguate this from a rename
-- of an existing nullable integer column.

ALTER TABLE "revenue_snapshots" ADD COLUMN "installs" integer;
