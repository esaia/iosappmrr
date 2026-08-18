CREATE TYPE "public"."app_status" AS ENUM('draft', 'pending', 'live', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'active', 'error', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."provider_id" AS ENUM('revenuecat', 'app_store_connect', 'superwall', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('founder', 'admin');--> statement-breakpoint
CREATE TABLE "app_metrics" (
	"app_id" uuid PRIMARY KEY NOT NULL,
	"mrr_cents" bigint DEFAULT 0 NOT NULL,
	"arr_cents" bigint DEFAULT 0 NOT NULL,
	"active_subscriptions" integer,
	"growth_30d" real,
	"growth_90d" real,
	"sparkline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_as_of" date,
	"providers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_store_metadata" (
	"app_id" uuid PRIMARY KEY NOT NULL,
	"track_name" text,
	"seller_name" text,
	"icon_url" text,
	"screenshot_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_cents" integer,
	"currency" text,
	"has_in_app_purchases" boolean,
	"average_rating" real,
	"rating_count" integer,
	"version" text,
	"primary_genre" text,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_rating" text,
	"released_at" timestamp with time zone,
	"updated_in_store_at" timestamp with time zone,
	"file_size_bytes" bigint,
	"supported_devices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minimum_os_version" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_tech_stack" (
	"app_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "app_tech_stack_app_id_tag_id_pk" PRIMARY KEY("app_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "app_views" (
	"app_id" uuid NOT NULL,
	"viewed_on" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "app_views_app_id_viewed_on_pk" PRIMARY KEY("app_id","viewed_on")
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"app_store_id" text NOT NULL,
	"bundle_id" text,
	"app_store_url" text,
	"founder_id" uuid NOT NULL,
	"category_id" uuid,
	"status" "app_status" DEFAULT 'draft' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"launched_at" date,
	"website" text,
	"twitter" text,
	"for_sale" boolean DEFAULT false NOT NULL,
	"asking_price_cents" bigint,
	"sale_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"app_store_genre" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"profile_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_profile_id_app_id_pk" PRIMARY KEY("profile_id","app_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"bio" text,
	"website" text,
	"twitter" text,
	"role" "user_role" DEFAULT 'founder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"provider" "provider_id" NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"encrypted_credentials" "bytea" NOT NULL,
	"account_label" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"provider" "provider_id" NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mrr_cents" bigint NOT NULL,
	"active_subscriptions" integer,
	"active_trials" integer,
	"new_customers_28d" integer,
	"revenue_28d_cents" bigint,
	"currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_stack_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'tooling' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_metrics" ADD CONSTRAINT "app_metrics_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_store_metadata" ADD CONSTRAINT "app_store_metadata_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_tech_stack" ADD CONSTRAINT "app_tech_stack_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_tech_stack" ADD CONSTRAINT "app_tech_stack_tag_id_tech_stack_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tech_stack_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_views" ADD CONSTRAINT "app_views_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_founder_id_profiles_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_connections" ADD CONSTRAINT "revenue_connections_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_snapshots" ADD CONSTRAINT "revenue_snapshots_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_metrics_mrr_idx" ON "app_metrics" USING btree ("mrr_cents");--> statement-breakpoint
CREATE INDEX "app_metrics_growth_idx" ON "app_metrics" USING btree ("growth_30d");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_slug_key" ON "apps" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_app_store_id_key" ON "apps" USING btree ("app_store_id");--> statement-breakpoint
CREATE INDEX "apps_founder_idx" ON "apps" USING btree ("founder_id");--> statement-breakpoint
CREATE INDEX "apps_status_idx" ON "apps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apps_category_idx" ON "apps" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_connections_app_provider_key" ON "revenue_connections" USING btree ("app_id","provider");--> statement-breakpoint
CREATE INDEX "revenue_connections_sync_idx" ON "revenue_connections" USING btree ("status","last_synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_snapshots_app_provider_day_key" ON "revenue_snapshots" USING btree ("app_id","provider","captured_on");--> statement-breakpoint
CREATE INDEX "revenue_snapshots_app_day_idx" ON "revenue_snapshots" USING btree ("app_id","captured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "tech_stack_tags_slug_key" ON "tech_stack_tags" USING btree ("slug");