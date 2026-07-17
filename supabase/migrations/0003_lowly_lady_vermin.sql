-- 部分適用された本番でも再 migrate が安全に通るよう冪等化（IF NOT EXISTS）
ALTER TABLE "municipality_master" ADD COLUMN IF NOT EXISTS "kana" text;