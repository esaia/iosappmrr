-- Dodo Payments replaces Paddle, whose live account never finished Paddle's
-- own account review — checkout stayed dead with no ETA. `paddle` is kept as
-- a value rather than renamed: a real purchase, if one ever settled, stays
-- recorded as what it actually was. Every new paid row uses `dodo`.
--
-- Written by hand: `ALTER TYPE … ADD VALUE` is the only way to extend a live
-- enum without dropping and recreating the type, which would mean rewriting
-- every purchase row that references it.

ALTER TYPE "public"."purchase_source" ADD VALUE IF NOT EXISTS 'dodo' BEFORE 'admin';--> statement-breakpoint
ALTER TABLE "purchases" ALTER COLUMN "source" SET DEFAULT 'dodo';
