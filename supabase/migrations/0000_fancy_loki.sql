CREATE TABLE IF NOT EXISTS "municipality_master" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"prefecture" text NOT NULL,
	"region" text NOT NULL,
	"population" integer,
	"population_year" integer,
	"difficulty" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "municipality_quiz_results" (
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
CREATE INDEX IF NOT EXISTS "mm_difficulty_idx" ON "municipality_master" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mm_region_diff_idx" ON "municipality_master" USING btree ("region","difficulty");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mqr_user_code_idx" ON "municipality_quiz_results" USING btree ("user_id","municipality_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mqr_user_time_idx" ON "municipality_quiz_results" USING btree ("user_id","answered_at");--> statement-breakpoint
-- RLS: municipality_master は認証ユーザーに読み取り許可（drizzle schema 管理外のため手動同梱）
-- 既存テーブルを持つ本番でも初回 migrate が安全に通るよう全て冪等化（IF NOT EXISTS / DROP+CREATE）
ALTER TABLE "municipality_master" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "mm_read_authenticated" ON "municipality_master";--> statement-breakpoint
CREATE POLICY "mm_read_authenticated" ON "municipality_master" FOR SELECT TO authenticated USING (true);