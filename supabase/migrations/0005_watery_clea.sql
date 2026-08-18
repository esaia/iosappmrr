CREATE TYPE "public"."purchase_kind" AS ENUM('dofollow', 'sponsor');--> statement-breakpoint
CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "purchase_kind" NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"profile_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"polar_checkout_id" text NOT NULL,
	"polar_order_id" text,
	"polar_subscription_id" text,
	"amount_cents" bigint,
	"currency" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_polar_checkout_key" ON "purchases" USING btree ("polar_checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_polar_subscription_key" ON "purchases" USING btree ("polar_subscription_id");--> statement-breakpoint
CREATE INDEX "purchases_app_kind_idx" ON "purchases" USING btree ("app_id","kind","status");--> statement-breakpoint
CREATE INDEX "purchases_status_idx" ON "purchases" USING btree ("status");