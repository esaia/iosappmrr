ALTER TABLE "apps" ADD COLUMN "value_proposition" text;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "problem_solved" text;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "audience_type" "audience_type";--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "market_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "marketing_channels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "additional_info" text;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "value_proposition";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "problem_solved";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "audience";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "audience_type";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "market_tags";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "marketing_channels";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "additional_info";