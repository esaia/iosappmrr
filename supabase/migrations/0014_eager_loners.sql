CREATE TABLE "app_store_reviews" (
	"app_id" uuid NOT NULL,
	"review_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text,
	"author" text,
	"reviewed_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_store_reviews_app_id_review_id_pk" PRIMARY KEY("app_id","review_id")
);
--> statement-breakpoint
ALTER TABLE "app_store_metadata" ADD COLUMN "rating_histogram" jsonb;--> statement-breakpoint
ALTER TABLE "app_store_reviews" ADD CONSTRAINT "app_store_reviews_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;