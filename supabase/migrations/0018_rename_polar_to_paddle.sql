-- Polar is out, Paddle is in: Polar settles over Stripe Connect Express, which
-- does not cover Georgia. The columns were named after the provider, so the
-- names move with it — and since they hold nothing provider-specific beyond an
-- id, they are named for what they are rather than for whoever issues them.
--
-- Written by hand rather than generated because a generated diff would drop and
-- recreate these columns, and a rename keeps whatever a live database holds.
-- `purchases` is empty as this ships, but a migration that only works on an
-- empty table is a trap for the next environment it runs in.

ALTER TABLE "purchases" RENAME COLUMN "polar_checkout_id" TO "checkout_id";--> statement-breakpoint
ALTER TABLE "purchases" RENAME COLUMN "polar_order_id" TO "order_id";--> statement-breakpoint
ALTER TABLE "purchases" RENAME COLUMN "polar_subscription_id" TO "subscription_id";--> statement-breakpoint

ALTER INDEX "purchases_polar_checkout_key" RENAME TO "purchases_checkout_key";--> statement-breakpoint
ALTER INDEX "purchases_polar_subscription_key" RENAME TO "purchases_subscription_key";--> statement-breakpoint

-- The enum value renames in place, so existing rows follow it without an
-- UPDATE. The column default names the value literally and has to be re-stated.
ALTER TYPE "public"."purchase_source" RENAME VALUE 'polar' TO 'paddle';--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "source" SET DEFAULT 'paddle';
