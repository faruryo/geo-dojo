-- Add answer_time_ms column to municipality_quiz_results
ALTER TABLE "municipality_quiz_results" ADD COLUMN IF NOT EXISTS "answer_time_ms" integer;

-- Ensure Row Level Security remains enabled with user-isolated policy (idempotent)
ALTER TABLE "municipality_quiz_results" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own quiz_results" ON "municipality_quiz_results";
CREATE POLICY "Users can manage own quiz_results"
  ON "municipality_quiz_results"
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
