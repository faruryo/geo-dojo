-- 部分適用された本番でも再 migrate が安全に通るよう全て冪等化（IF NOT EXISTS / DROP+CREATE / ON CONFLICT）
CREATE TABLE IF NOT EXISTS "srs_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"municipality_code" text NOT NULL,
	"municipality_name" text NOT NULL,
	"prefecture" text NOT NULL,
	"mode" text NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"repetition" integer DEFAULT 0 NOT NULL,
	"interval" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"status" text DEFAULT 'reviewing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "srs_user_due_idx" ON "srs_records" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "srs_user_code_mode_uidx" ON "srs_records" USING btree ("user_id","municipality_code","mode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "srs_user_status_idx" ON "srs_records" USING btree ("user_id","status");--> statement-breakpoint

-- RLS
ALTER TABLE "srs_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users can manage own srs_records" ON "srs_records";--> statement-breakpoint
CREATE POLICY "Users can manage own srs_records"
  ON "srs_records"
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint

-- Backfill: 既存誤答ログから復習対象を初期生成（due_date=now で即時到来）
INSERT INTO srs_records (
  id,
  user_id,
  municipality_code,
  municipality_name,
  prefecture,
  mode,
  ease_factor,
  repetition,
  interval,
  due_date,
  last_reviewed_at,
  status,
  created_at
)
SELECT
  gen_random_uuid(),
  user_id,
  municipality_code,
  (array_agg(municipality_name ORDER BY answered_at DESC))[1],
  (array_agg(prefecture ORDER BY answered_at DESC))[1],
  mode,
  2.5,
  0,
  0,
  now(),
  NULL,
  'reviewing',
  now()
FROM municipality_quiz_results
GROUP BY user_id, municipality_code, mode
HAVING SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) > 0
ON CONFLICT (user_id, municipality_code, mode) DO NOTHING;