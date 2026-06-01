-- CI 用 Supabase 互換スタブ
-- 使い捨て Postgres に対して本番と同じ drizzle-kit migrate を流すため、
-- マイグレーションが依存する Supabase 固有のロール / 関数だけを最小限で用意する。
-- （本番の挙動を変えるものではなく、CI の検証環境を本番に近づけるためのもの）

CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS ポリシーの式解決に必要（実体は常に NULL を返すスタブで十分）
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
