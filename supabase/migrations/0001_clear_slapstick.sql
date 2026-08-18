CREATE TYPE "public"."audience_type" AS ENUM('B2C', 'B2B', 'B2B2C');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "value_proposition" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "problem_solved" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "audience_type" "audience_type";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "market_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "marketing_channels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "additional_info" text;