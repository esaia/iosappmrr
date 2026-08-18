CREATE TYPE "public"."vibecode_verdict" AS ENUM('yes', 'kinda', 'not_really');--> statement-breakpoint
CREATE TABLE "vibecode_verdicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid NOT NULL,
	"verdict" "vibecode_verdict" NOT NULL,
	"headline" text NOT NULL,
	"reasoning" text NOT NULL,
	"rebuildable" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moat" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" integer DEFAULT 1 NOT NULL,
	"edited_by_human" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vibecode_verdicts" ADD CONSTRAINT "vibecode_verdicts_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vibecode_verdicts_app_key" ON "vibecode_verdicts" USING btree ("app_id");