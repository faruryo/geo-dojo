# Quickstart: 誤答なし市区町村の早期卒業

## テスト実行

```bash
pnpm test                     # Vitest（純粋関数テスト）
pnpm lint                     # 型チェック / Lint
```

主対象: `__tests__/lib/quiz/srs/update.test.ts`（早期卒業シナリオ追加分）

## 動作確認（ローカル）

```bash
supabase start                # ローカル Supabase（別データ）
pnpm dev
```

1. 新しい市区町村に正解 → `srs_records` に rep=1 / reviewing で作成される
2. `last_reviewed_at` を前日に更新（同日ガード回避のテスト用操作）して再度正解 → status が `graduated` になる
3. ダッシュボード「覚えている途中の市区町村」に表示されないことを確認

## バックフィル実行（既存レコード一括卒業）

```bash
# ローカル
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  pnpm tsx scripts/backfill-early-graduation.ts

# 本番（実行前に .env.prod.local の DATABASE_URL を確認）
DATABASE_URL=<prod-url> pnpm tsx scripts/backfill-early-graduation.ts
```

- 冪等なので再実行可
- 実行後、ダッシュボードの「覚えている途中」件数が減っていることを確認
