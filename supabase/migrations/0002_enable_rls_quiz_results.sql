-- municipality_quiz_results に RLS を追加（drizzle schema 管理外のため手動同梱）
-- 0000 で作成された際に RLS 有効化が漏れており、Supabase Data API (PostgREST) +
-- publishable key 経由で全ユーザーのクイズ履歴が read/改ざん/削除可能だった。
-- 部分適用された本番でも再 migrate が安全に通るよう冪等化（IF EXISTS / DROP+CREATE）。
ALTER TABLE "municipality_quiz_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "Users can manage own quiz_results" ON "municipality_quiz_results";--> statement-breakpoint
CREATE POLICY "Users can manage own quiz_results"
  ON "municipality_quiz_results"
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
