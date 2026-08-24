CREATE INDEX IF NOT EXISTS "mqr_user_mode_correct_code_idx" ON "municipality_quiz_results" USING btree ("user_id", "mode", "is_correct", "municipality_code");
