CREATE TABLE "ai_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text,
	"pano_id" text,
	"suggested_notes" text,
	"suggested_tags" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"x_ratio" real NOT NULL,
	"y_ratio" real NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"image_url" text,
	"pano_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipality_quiz_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"municipality_code" text NOT NULL,
	"municipality_name" text NOT NULL,
	"prefecture" text NOT NULL,
	"mode" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"due_date" timestamp DEFAULT now() NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"easiness" real DEFAULT 2.5 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"last_rated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_records" ADD CONSTRAINT "srs_records_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_candidates_user_id_idx" ON "ai_candidates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_candidates_user_status_idx" ON "ai_candidates" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "annotations_card_id_idx" ON "annotations" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "cards_user_id_idx" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mqr_user_code_idx" ON "municipality_quiz_results" USING btree ("user_id","municipality_code");--> statement-breakpoint
CREATE INDEX "mqr_user_time_idx" ON "municipality_quiz_results" USING btree ("user_id","answered_at");--> statement-breakpoint
CREATE INDEX "srs_user_due_idx" ON "srs_records" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "srs_user_card_unique" ON "srs_records" USING btree ("user_id","card_id");