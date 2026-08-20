-- Adapty joins RevenueCat and App Store Connect as a source a founder can
-- connect. Its analytics API reports MRR for one Adapty app, filtered here to
-- App Store purchases so an app is never credited with its Android twin's
-- revenue.
--
-- Added before `app_store_connect` so the enum's order still matches the order
-- the providers are listed in — a generated diff would otherwise want to
-- rewrite the type on the next migration.
--
-- Written by hand: `ALTER TYPE … ADD VALUE` is the only way to extend a live
-- enum without dropping and recreating the type, which would mean rewriting
-- every connection and snapshot row that references it.

ALTER TYPE "public"."provider_id" ADD VALUE IF NOT EXISTS 'adapty' BEFORE 'app_store_connect';
